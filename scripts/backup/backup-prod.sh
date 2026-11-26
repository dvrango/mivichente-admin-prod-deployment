#!/usr/bin/env bash
#
# Production backup: DB dump + mirror of the Storage buckets → Cloudflare R2.
# Runs on the minipc from a systemd timer (daily). See README.md for the restore procedure.
#
# Reads its secrets from a file outside the repo (~/.config/vichente-backup/env by default).
# It does not need the prod DB password: the Supabase CLI authenticates with
# SUPABASE_ACCESS_TOKEN and provisions a temporary role on every run.
#
# The messages it sends to Discord and writes to the log are in Spanish: the owner reads them.
#
set -euo pipefail

# The Supabase CLI lives in linuxbrew and the postgres client outside the minimal PATH.
# Neither is there when this runs from systemd or from `ssh host script`, so the
# script does not depend on the caller's PATH.
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH:/usr/lib/postgresql/17/bin"

PROJECT_REF="fmvzwonzcnkrhjdeonaz"
R2_BUCKET="vichente-backups"
DB_RETENTION_DAYS=30
TRASH_RETENTION_DAYS=90
BUCKETS=(business-photos registration-photos)

ENV_FILE="${VICHENTE_BACKUP_ENV:-$HOME/.config/vichente-backup/env}"
WORKDIR="${VICHENTE_BACKUP_WORKDIR:-$HOME/vichente-backup}"
# deploy-to-minipc.sh copies the helper scripts next to this one.
BIN_DIR="$(cd "$(dirname "$0")" && pwd)"

TODAY="$(date +%Y-%m-%d)"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TMPDIR="$(mktemp -d)"
STEP="arranque"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

# --- Discord ---------------------------------------------------------------

notify() {
  local text="$1"
  if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
    log "(sin DISCORD_WEBHOOK_URL, no se notifica)"
    return 0
  fi
  # `|| log`: a network failure while notifying must not take the backup down.
  jq -Rn --arg c "$text" '{content: $c}' \
    | curl -sf -X POST -H 'Content-Type: application/json' -d @- "$DISCORD_WEBHOOK_URL" >/dev/null \
    || log "ADVERTENCIA: no se pudo notificar a Discord"
}

# Fires on any error through set -e. Reports the step where it died.
on_error() {
  local code=$?
  log "FALLÓ en el paso: $STEP (exit $code)"
  notify "🔴 **Backup de Vichente falló**
Paso: \`$STEP\` (exit $code)
Host: \`$(hostname)\` · $STAMP
Revisar: \`journalctl -u vichente-backup.service -n 50\`"
  rm -rf "$TMPDIR"
  exit "$code"
}
trap on_error ERR

# --- Configuration ---------------------------------------------------------

STEP="cargar configuración"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: no existe $ENV_FILE — ver README.md, sección Setup." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

for var in SUPABASE_ACCESS_TOKEN SUPABASE_S3_ACCESS_KEY_ID SUPABASE_S3_SECRET_ACCESS_KEY \
           R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if [ -z "${!var:-}" ]; then
    echo "Error: falta $var en $ENV_FILE" >&2
    exit 1
  fi
done

# rclone remotes from environment variables, so no rclone.conf with secrets is left behind.
export RCLONE_CONFIG_SUPA_TYPE=s3
export RCLONE_CONFIG_SUPA_PROVIDER=Other
export RCLONE_CONFIG_SUPA_ENDPOINT="https://${PROJECT_REF}.storage.supabase.co/storage/v1/s3"
export RCLONE_CONFIG_SUPA_REGION=us-west-2
export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_ACCESS_KEY"

# Without this rclone warns on every call that it cannot find rclone.conf. It is not
# missing: the remotes are defined by environment variables, to keep secrets off disk.
export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_R2_TYPE=s3
# The R2 token is Object Read & Write on a single bucket, on purpose: it cannot create
# buckets. By default rclone checks/creates the destination bucket before writing, and
# that returns 403 AccessDenied on CreateBucket. It only shows when --backup-dir has
# something to move, that is, the first time something is deleted in prod — which is
# exactly how the backup of 2026-08-28 failed.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

# --- Database dump ---------------------------------------------------------

STEP="dump de la base de datos"
log "Dump de $PROJECT_REF …"
cd "$WORKDIR"

# --role-only   : the cluster roles, needed before the schema in a clean restore.
# (no flags)    : the schema as it is in prod TODAY, which may have drifted from the migrations.
# --data-only   : the only irreplaceable part. --use-copy makes the restore much faster.
supabase db dump --linked --role-only  -f "$TMPDIR/roles.sql"
supabase db dump --linked              -f "$TMPDIR/schema.sql"
supabase db dump --linked --data-only --use-copy -f "$TMPDIR/data.sql"

STEP="comprimir dump"
gzip -9 "$TMPDIR/roles.sql" "$TMPDIR/schema.sql" "$TMPDIR/data.sql"

# How many businesses this dump has. It is the number compared when verifying a restore.
# The awk reads the whole file instead of exiting when the block closes: an early `exit`
# sends SIGPIPE to gzip and, with pipefail, that takes the whole script down.
business_count="$(gzip -dc "$TMPDIR/data.sql.gz" | awk '
  /^COPY "?public"?\."?businesses"?/ { inside = 1; next }
  inside && /^\\\.$/                { inside = 0 }
  inside                            { n++ }
  END                               { print n + 0 }
')"
: "${business_count:=0}"
dump_size="$(du -ch "$TMPDIR"/*.sql.gz | tail -1 | cut -f1)"
log "Dump listo: $business_count negocios, $dump_size"

if [ "$business_count" -lt 1 ]; then
  echo "Error: el dump trae $business_count negocios — algo salió mal, no se sube." >&2
  exit 1
fi

STEP="subir dump a R2"
rclone copy "$TMPDIR" "r2:${R2_BUCKET}/db/${TODAY}/" --include '*.sql.gz' --stats-one-line
log "Dump en r2:${R2_BUCKET}/db/${TODAY}/"

# --- Order retention -------------------------------------------------------

# The purge of the customers' data on orders runs in prod by pg_cron (uuyrkazz7),
# not here. This only reads its run log from the dump that just came down, because
# if pg_cron stops nothing errors anywhere: the data just stays. Like the rotation,
# a stale purge does not fail the backup; it is reported on its own.
STEP="revisar la limpieza de pedidos"
retention_code=0
retention_line="$("$BIN_DIR/order-retention-status.sh" "$TMPDIR/data.sql.gz")" || retention_code=$?
log "$retention_line"
if [ "$retention_code" -eq 1 ]; then
  notify "🟠 **Vichente: la limpieza de pedidos dejó de correr**
${retention_line}
Revisar en Supabase: \`select * from cron.job_run_details order by start_time desc limit 5\`"
elif [ "$retention_code" -gt 2 ]; then
  retention_line="Limpieza de pedidos: no se pudo revisar (exit ${retention_code})."
  log "ADVERTENCIA: $retention_line"
fi

# --- Storage bucket mirror -------------------------------------------------

# Incremental sync: only uploads what changed. What is deleted or replaced in prod is
# NOT removed from the mirror — it moves to storage-papelera/<date>/, so an accidental
# delete in prod does not propagate to the backup.
for bucket in "${BUCKETS[@]}"; do
  STEP="espejo del bucket $bucket"
  log "Sincronizando $bucket …"
  rclone sync "supa:${bucket}" "r2:${R2_BUCKET}/storage/${bucket}" \
    --backup-dir "r2:${R2_BUCKET}/storage-papelera/${TODAY}/${bucket}" \
    --stats-one-line
done

# --- Rotation --------------------------------------------------------------

STEP="rotación"

# A rotation failure must NOT take the backup down: at this point the dump and the mirror
# are already up and safe. But it is not silenced either — if the cleanup fails every
# night, R2 grows without anyone noticing until it hits the limit.
rotate() {
  local target="$1" days="$2"
  if ! rclone delete "$target" --min-age "${days}d" --rmdirs; then
    log "ADVERTENCIA: falló la rotación de $target"
    notify "🟠 **Backup de Vichente: falló la rotación**
El backup del \`${TODAY}\` sí se subió completo. Lo que no corrió fue la limpieza de \`${target}\`.
Si se repite, R2 va a seguir creciendo."
  fi
}

rotate "r2:${R2_BUCKET}/db"               "$DB_RETENTION_DAYS"
rotate "r2:${R2_BUCKET}/storage-papelera" "$TRASH_RETENTION_DAYS"

# --- Signals ---------------------------------------------------------------

# Sundays only: confirms the backup is still running. If the message did not arrive
# this week, something broke — even if there was no error to report.
#
# Counts the backups that really exist in R2, not just today's. Reporting "I ran fine"
# would be enough to hide that Tuesday did not run: next Sunday the message would
# arrive just as green with a one-day gap in the history.
heartbeat() {
  local total days oldest expected warning=""
  total="$(rclone size "r2:${R2_BUCKET}" --json | jq -r '.bytes' | numfmt --to=iec)"
  days="$(rclone lsf "r2:${R2_BUCKET}/db/" --dirs-only | grep -c '/$')"
  oldest="$(rclone lsf "r2:${R2_BUCKET}/db/" --dirs-only | sed 's#/$##' | sort | head -1)"

  # How many days there should be: from the oldest backup to today, capped at the retention.
  expected=$(( ( $(date +%s) - $(date -d "$oldest" +%s) ) / 86400 + 1 ))
  [ "$expected" -gt "$DB_RETENTION_DAYS" ] && expected="$DB_RETENTION_DAYS"

  if [ "$days" -lt "$expected" ]; then
    warning="
⚠️ Faltan días: hay **${days}** backups y debería haber **${expected}**. Algún día no corrió."
  fi

  notify "🟢 **Backup de Vichente sigue vivo**
Último: \`${TODAY}\` · **${business_count}** negocios · dump ${dump_size}
Historial: ${days}/${expected} días · ocupado en R2: ${total}${warning}
${retention_line}"
}

# VICHENTE_FORZAR_HEARTBEAT=1 fires it on any day. It exists to test this branch
# without waiting for Sunday, which is how it slipped in untested the first time.
if [ "$(date +%u)" -eq 7 ] || [ -n "${VICHENTE_FORZAR_HEARTBEAT:-}" ]; then
  STEP="heartbeat semanal"
  # If the report fails, a backup that already completed is not marked as failed.
  heartbeat || log "ADVERTENCIA: no se pudo enviar el heartbeat"
fi

rm -rf "$TMPDIR"
trap - ERR
log "✓ Backup completo"
