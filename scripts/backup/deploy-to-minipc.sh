#!/usr/bin/env bash
#
# Copies the backup scripts to the minipc and reports what is missing to leave it running.
#
# What needs sudo (installing packages, registering the systemd units) is NOT run here:
# the minipc asks for a password for sudo. setup-minipc.sh takes care of that, and this
# script leaves it copied over there.
#
# The output is in Spanish: the owner reads it.
#
set -euo pipefail

HOST="${VICHENTE_MINIPC_HOST:-minipc}"
REMOTE="/home/dvrango/vichente-backup"
HERE="$(cd "$(dirname "$0")" && pwd)"

log() { printf '  %s\n' "$*"; }

echo
echo "Desplegando a $HOST …"
echo

ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" true 2>/dev/null \
  || { echo "Error: no hay SSH a '$HOST'. Revisa ~/.ssh/config." >&2; exit 1; }

# --- Copy ------------------------------------------------------------------

ssh "$HOST" "mkdir -p $REMOTE/bin $REMOTE/systemd ~/.config/vichente-backup"
scp -q "$HERE/backup-prod.sh" "$HERE/order-retention-status.sh" "$HERE/restore-check.sh" \
  "$HERE/refresh-local.sh" "$HERE/setup-minipc.sh" "$HOST:$REMOTE/bin/"
scp -q "$HERE/systemd/"*.service "$HERE/systemd/"*.timer "$HOST:$REMOTE/systemd/"
ssh "$HOST" "chmod +x $REMOTE/bin/*.sh"
log "✓ scripts en $REMOTE/bin/"

# --- Diagnosis -------------------------------------------------------------

# Same PATH the service uses. The Supabase CLI lives in linuxbrew, which is not in the
# PATH of a non-interactive SSH session nor in systemd's.
REMOTE_PATH='/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/17/bin'
missing="$(ssh "$HOST" "PATH=$REMOTE_PATH; for c in supabase rclone psql jq docker; do command -v \$c >/dev/null || printf '%s ' \"\$c\"; done")"
# `supabase db dump` runs pg_dump inside a container: without the image, the first run
# downloads ~1 GB in the middle of the timer.
has_image="$(ssh "$HOST" 'docker image ls --format "{{.Repository}}" 2>/dev/null | grep -q "supabase/postgres" && echo yes || echo no')"
has_env="$(ssh "$HOST" '[ -s ~/.config/vichente-backup/env ] && echo yes || echo no')"
has_link="$(ssh "$HOST" "[ -f $REMOTE/supabase/.temp/project-ref ] && echo yes || echo no")"
has_timer="$(ssh "$HOST" 'systemctl list-unit-files vichente-backup.timer --no-legend 2>/dev/null | grep -q . && echo yes || echo no')"
has_refresh_timer="$(ssh "$HOST" 'systemctl list-unit-files vichente-refresh-local.timer --no-legend 2>/dev/null | grep -q . && echo yes || echo no')"

echo
[ -z "$missing" ]               && log "✓ dependencias instaladas"        || log "✗ faltan comandos: $missing"
[ "$has_image" = yes ]          && log "✓ imagen de postgres descargada"  || log "· imagen de postgres sin descargar (la baja sola en la 1ª corrida)"
[ "$has_env" = yes ]            && log "✓ archivo de secretos presente"   || log "✗ falta ~/.config/vichente-backup/env"
[ "$has_link" = yes ]           && log "✓ proyecto de Supabase enlazado"  || log "✗ falta 'supabase link'"
[ "$has_timer" = yes ]          && log "✓ timer registrado en systemd"    || log "✗ falta registrar el timer"
[ "$has_refresh_timer" = yes ]  && log "✓ timer de la copia a la DB local registrado" || log "✗ falta registrar el timer de la copia a la DB local"
echo

if [ -z "$missing" ] && [ "$has_env" = yes ] && [ "$has_link" = yes ] && [ "$has_timer" = yes ] && [ "$has_refresh_timer" = yes ]; then
  echo "Todo listo. Correr a mano:  ssh $HOST 'sudo systemctl start vichente-backup.service'"
  echo "Copia a la DB local:        ssh $HOST 'sudo systemctl start vichente-refresh-local.service'"
  echo "Ver las próximas corridas:  ssh $HOST 'systemctl list-timers \"vichente-*\"'"
  exit 0
fi

# --- What is left to do ----------------------------------------------------

echo "───────────────────────────────────────────────────────────────"

if [ "$has_env" = no ]; then
  cat <<'STEP'
Falta el archivo de secretos. En el minipc:

  ssh minipc
  install -d -m 700 ~/.config/vichente-backup
  cat > ~/.config/vichente-backup/env <<'EOF'
  SUPABASE_ACCESS_TOKEN=
  SUPABASE_S3_ACCESS_KEY_ID=
  SUPABASE_S3_SECRET_ACCESS_KEY=
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  DISCORD_WEBHOOK_URL=
  EOF
  chmod 600 ~/.config/vichente-backup/env
  nano ~/.config/vichente-backup/env

De dónde sale cada valor: ver README.md, sección Setup.
STEP
  echo
fi

cat <<STEP
Todo lo demás lo hace un solo script, en el minipc:

  ssh $HOST
  $REMOTE/bin/setup-minipc.sh

Instala dependencias, enlaza el proyecto y registra el timer. Pide sudo una vez
y es idempotente: salta lo que ya esté hecho.
STEP
echo
echo "Cuando termines, corre este script otra vez para confirmar."
