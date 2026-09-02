#!/usr/bin/env bash
#
# Backup de producción: dump de la DB + espejo de los buckets de Storage → Cloudflare R2.
# Corre en el minipc por systemd timer (diario). Ver README.md para el procedimiento de restore.
#
# Lee los secretos de un archivo fuera del repo (por defecto ~/.config/vichente-backup/env).
# No requiere el password de la DB de prod: el CLI de Supabase se autentica con
# SUPABASE_ACCESS_TOKEN y provisiona un rol temporal en cada corrida.
#
set -euo pipefail

# El CLI de Supabase vive en linuxbrew y el cliente de postgres fuera del PATH mínimo.
# Ninguno de los dos está presente cuando esto corre por systemd o por `ssh host script`,
# así que el script no depende del PATH de quien lo invoca.
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH:/usr/lib/postgresql/17/bin"

PROJECT_REF="fmvzwonzcnkrhjdeonaz"
R2_BUCKET="vichente-backups"
RETENCION_DB_DIAS=30
RETENCION_PAPELERA_DIAS=90
BUCKETS=(business-photos registration-photos)

ENV_FILE="${VICHENTE_BACKUP_ENV:-$HOME/.config/vichente-backup/env}"
WORKDIR="${VICHENTE_BACKUP_WORKDIR:-$HOME/vichente-backup}"

FECHA="$(date +%Y-%m-%d)"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TMPDIR="$(mktemp -d)"
PASO="arranque"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

# --- Discord ---------------------------------------------------------------

notificar() {
  local texto="$1"
  if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
    log "(sin DISCORD_WEBHOOK_URL, no se notifica)"
    return 0
  fi
  # `|| true`: que una falla de red al notificar no tumbe el backup.
  jq -Rn --arg c "$texto" '{content: $c}' \
    | curl -sf -X POST -H 'Content-Type: application/json' -d @- "$DISCORD_WEBHOOK_URL" >/dev/null \
    || log "ADVERTENCIA: no se pudo notificar a Discord"
}

# Se dispara con cualquier error por set -e. Reporta en qué paso murió.
al_fallar() {
  local codigo=$?
  log "FALLÓ en el paso: $PASO (exit $codigo)"
  notificar "🔴 **Backup de Vichente falló**
Paso: \`$PASO\` (exit $codigo)
Host: \`$(hostname)\` · $STAMP
Revisar: \`journalctl -u vichente-backup.service -n 50\`"
  rm -rf "$TMPDIR"
  exit "$codigo"
}
trap al_fallar ERR

# --- Configuración ---------------------------------------------------------

PASO="cargar configuración"
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

# Remotes de rclone por variables de entorno, para no dejar un rclone.conf con secretos.
export RCLONE_CONFIG_SUPA_TYPE=s3
export RCLONE_CONFIG_SUPA_PROVIDER=Other
export RCLONE_CONFIG_SUPA_ENDPOINT="https://${PROJECT_REF}.storage.supabase.co/storage/v1/s3"
export RCLONE_CONFIG_SUPA_REGION=us-west-2
export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_ACCESS_KEY"

# Sin esto rclone avisa en cada llamada que no encuentra rclone.conf. No falta:
# los remotes se definen por variables de entorno, para no dejar secretos en disco.
export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_R2_TYPE=s3
# El token de R2 es Object Read & Write sobre un solo bucket, a propósito: no puede
# crear buckets. rclone por defecto verifica/crea el bucket destino antes de escribir,
# y eso devuelve 403 AccessDenied sobre CreateBucket. Se ve solo cuando --backup-dir
# tiene algo que mover, o sea la primera vez que algo se borra en prod — que fue
# exactamente cómo falló el backup del 2026-08-28.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

# --- Dump de la base de datos ----------------------------------------------

PASO="dump de la base de datos"
log "Dump de $PROJECT_REF …"
cd "$WORKDIR"

# --role-only   : los roles del cluster, necesarios antes del schema en un restore limpio.
# (sin flags)   : el schema tal como está HOY en prod, que puede haber divergido de las migrations.
# --data-only   : lo único irremplazable. --use-copy hace el restore mucho más rápido.
supabase db dump --linked --role-only  -f "$TMPDIR/roles.sql"
supabase db dump --linked              -f "$TMPDIR/schema.sql"
supabase db dump --linked --data-only --use-copy -f "$TMPDIR/data.sql"

PASO="comprimir dump"
gzip -9 "$TMPDIR/roles.sql" "$TMPDIR/schema.sql" "$TMPDIR/data.sql"

# Cuántos negocios trae este dump. Es el número que se compara al verificar un restore.
# El awk lee el archivo completo en vez de salir al cerrar el bloque: un `exit` temprano
# le manda SIGPIPE a gzip y, con pipefail, eso tumba el script entero.
negocios="$(gzip -dc "$TMPDIR/data.sql.gz" | awk '
  /^COPY "?public"?\."?businesses"?/ { dentro = 1; next }
  dentro && /^\\\.$/                { dentro = 0 }
  dentro                            { n++ }
  END                               { print n + 0 }
')"
: "${negocios:=0}"
peso="$(du -ch "$TMPDIR"/*.sql.gz | tail -1 | cut -f1)"
log "Dump listo: $negocios negocios, $peso"

if [ "$negocios" -lt 1 ]; then
  echo "Error: el dump trae $negocios negocios — algo salió mal, no se sube." >&2
  exit 1
fi

PASO="subir dump a R2"
rclone copy "$TMPDIR" "r2:${R2_BUCKET}/db/${FECHA}/" --include '*.sql.gz' --stats-one-line
log "Dump en r2:${R2_BUCKET}/db/${FECHA}/"

# --- Espejo de los buckets de Storage --------------------------------------

# sync incremental: solo sube lo que cambió. Lo borrado o reemplazado en prod NO se
# elimina del espejo — se mueve a storage-papelera/<fecha>/, para que un borrado
# accidental en prod no se propague al backup.
for bucket in "${BUCKETS[@]}"; do
  PASO="espejo del bucket $bucket"
  log "Sincronizando $bucket …"
  rclone sync "supa:${bucket}" "r2:${R2_BUCKET}/storage/${bucket}" \
    --backup-dir "r2:${R2_BUCKET}/storage-papelera/${FECHA}/${bucket}" \
    --stats-one-line
done

# --- Rotación --------------------------------------------------------------

PASO="rotación"

# Una falla de rotación NO debe tumbar el backup: a este punto el dump y el espejo ya
# están arriba y a salvo. Pero tampoco se calla — si la limpieza falla todas las noches,
# R2 crece sin que nadie se entere hasta toparse con el límite.
rotar() {
  local ruta="$1" dias="$2"
  if ! rclone delete "$ruta" --min-age "${dias}d" --rmdirs; then
    log "ADVERTENCIA: falló la rotación de $ruta"
    notificar "🟠 **Backup de Vichente: falló la rotación**
El backup del \`${FECHA}\` sí se subió completo. Lo que no corrió fue la limpieza de \`${ruta}\`.
Si se repite, R2 va a seguir creciendo."
  fi
}

rotar "r2:${R2_BUCKET}/db"               "$RETENCION_DB_DIAS"
rotar "r2:${R2_BUCKET}/storage-papelera" "$RETENCION_PAPELERA_DIAS"

# --- Señales ---------------------------------------------------------------

# Solo los domingos: confirma que el backup sigue corriendo. Si esta semana no
# llegó el mensaje, algo se rompió — aunque no haya habido ningún error que reportar.
#
# Cuenta los backups que de verdad existen en R2, no solo el de hoy. Reportar
# "corrí bien" bastaría para tapar que el martes no corrió: el domingo siguiente
# el mensaje llegaría igual de verde con un hueco de un día en el historial.
heartbeat() {
  local total dias primero esperados aviso=""
  total="$(rclone size "r2:${R2_BUCKET}" --json | jq -r '.bytes' | numfmt --to=iec)"
  dias="$(rclone lsf "r2:${R2_BUCKET}/db/" --dirs-only | grep -c '/$')"
  primero="$(rclone lsf "r2:${R2_BUCKET}/db/" --dirs-only | sed 's#/$##' | sort | head -1)"

  # Cuántos días debería haber: desde el backup más viejo hasta hoy, con tope en la retención.
  esperados=$(( ( $(date +%s) - $(date -d "$primero" +%s) ) / 86400 + 1 ))
  [ "$esperados" -gt "$RETENCION_DB_DIAS" ] && esperados="$RETENCION_DB_DIAS"

  if [ "$dias" -lt "$esperados" ]; then
    aviso="
⚠️ Faltan días: hay **${dias}** backups y debería haber **${esperados}**. Algún día no corrió."
  fi

  notificar "🟢 **Backup de Vichente sigue vivo**
Último: \`${FECHA}\` · **${negocios}** negocios · dump ${peso}
Historial: ${dias}/${esperados} días · ocupado en R2: ${total}${aviso}"
}

# VICHENTE_FORZAR_HEARTBEAT=1 lo dispara cualquier día. Existe para poder probar esta
# rama sin esperar al domingo, que es como se coló sin probar la primera vez.
if [ "$(date +%u)" -eq 7 ] || [ -n "${VICHENTE_FORZAR_HEARTBEAT:-}" ]; then
  PASO="heartbeat semanal"
  # Si el reporte falla, no se marca como fallido un backup que ya quedó completo.
  heartbeat || log "ADVERTENCIA: no se pudo enviar el heartbeat"
fi

rm -rf "$TMPDIR"
trap - ERR
log "✓ Backup completo"
