#!/usr/bin/env bash
#
# Copia los scripts de backup al minipc y reporta qué falta para dejarlo corriendo.
#
# Lo que necesita sudo (instalar paquetes, registrar las unidades de systemd) NO se
# ejecuta aquí: el minipc pide password para sudo. De eso se encarga setup-minipc.sh,
# que este script deja copiado allá.
#
set -euo pipefail

HOST="${VICHENTE_MINIPC_HOST:-minipc}"
REMOTO="/home/dvrango/vichente-backup"
AQUI="$(cd "$(dirname "$0")" && pwd)"

log() { printf '  %s\n' "$*"; }

echo
echo "Desplegando a $HOST …"
echo

ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" true 2>/dev/null \
  || { echo "Error: no hay SSH a '$HOST'. Revisa ~/.ssh/config." >&2; exit 1; }

# --- Copiar ----------------------------------------------------------------

ssh "$HOST" "mkdir -p $REMOTO/bin $REMOTO/systemd ~/.config/vichente-backup"
scp -q "$AQUI/backup-prod.sh" "$AQUI/restore-check.sh" "$AQUI/setup-minipc.sh" "$HOST:$REMOTO/bin/"
scp -q "$AQUI/systemd/"*.service "$AQUI/systemd/"*.timer "$HOST:$REMOTO/systemd/"
ssh "$HOST" "chmod +x $REMOTO/bin/*.sh"
log "✓ scripts en $REMOTO/bin/"

# --- Diagnóstico -----------------------------------------------------------

# Mismo PATH que usa el service. El CLI de Supabase vive en linuxbrew, que no está
# en el PATH de una sesión SSH no interactiva ni en el de systemd.
PATH_REMOTO='/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/17/bin'
faltan="$(ssh "$HOST" "PATH=$PATH_REMOTO; for c in supabase rclone psql jq docker; do command -v \$c >/dev/null || printf '%s ' \"\$c\"; done")"
# `supabase db dump` corre pg_dump dentro de un contenedor: sin la imagen, la primera
# corrida se va a descargar ~1 GB en medio del timer.
hay_imagen="$(ssh "$HOST" 'docker image ls --format "{{.Repository}}" 2>/dev/null | grep -q "supabase/postgres" && echo si || echo no')"
hay_env="$(ssh "$HOST" '[ -s ~/.config/vichente-backup/env ] && echo si || echo no')"
hay_link="$(ssh "$HOST" "[ -f $REMOTO/supabase/.temp/project-ref ] && echo si || echo no")"
hay_timer="$(ssh "$HOST" 'systemctl list-unit-files vichente-backup.timer --no-legend 2>/dev/null | grep -q . && echo si || echo no')"

echo
[ -z "$faltan" ]        && log "✓ dependencias instaladas"        || log "✗ faltan comandos: $faltan"
[ "$hay_imagen" = si ]  && log "✓ imagen de postgres descargada"  || log "· imagen de postgres sin descargar (la baja sola en la 1ª corrida)"
[ "$hay_env" = si ]     && log "✓ archivo de secretos presente"   || log "✗ falta ~/.config/vichente-backup/env"
[ "$hay_link" = si ]    && log "✓ proyecto de Supabase enlazado"  || log "✗ falta 'supabase link'"
[ "$hay_timer" = si ]   && log "✓ timer registrado en systemd"    || log "✗ falta registrar el timer"
echo

if [ -z "$faltan" ] && [ "$hay_env" = si ] && [ "$hay_link" = si ] && [ "$hay_timer" = si ]; then
  echo "Todo listo. Correr a mano:  ssh $HOST 'sudo systemctl start vichente-backup.service'"
  echo "Ver la próxima corrida:     ssh $HOST 'systemctl list-timers vichente-backup.timer'"
  exit 0
fi

# --- Qué falta hacer -------------------------------------------------------

echo "───────────────────────────────────────────────────────────────"

if [ "$hay_env" = no ]; then
  cat <<'PASO'
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
PASO
  echo
fi

cat <<PASO
Todo lo demás lo hace un solo script, en el minipc:

  ssh $HOST
  $REMOTO/bin/setup-minipc.sh

Instala dependencias, enlaza el proyecto y registra el timer. Pide sudo una vez
y es idempotente: salta lo que ya esté hecho.
PASO
echo
echo "Cuando termines, corre este script otra vez para confirmar."
