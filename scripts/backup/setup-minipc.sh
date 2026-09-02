#!/usr/bin/env bash
#
# Deja el minipc listo para correr el backup: dependencias, enlace al proyecto de
# Supabase y timer de systemd. Corre EN EL MINIPC, no en la Mac.
#
#   ssh minipc
#   ~/vichente-backup/bin/setup-minipc.sh
#
# Es idempotente: salta lo que ya esté hecho, así que se puede correr las veces
# que haga falta. Pide el password de sudo una sola vez, al principio.
#
set -euo pipefail

# linuxbrew no está en el PATH de sesiones no interactivas; el CLI de Supabase vive ahí.
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH:/usr/lib/postgresql/17/bin"

PROJECT_REF="fmvzwonzcnkrhjdeonaz"
BASE="/home/dvrango/vichente-backup"
ENV_FILE="$HOME/.config/vichente-backup/env"

paso()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()    { printf '  ✓ %s\n' "$*"; }
salta() { printf '  · %s\n' "$*"; }

if [ "$(id -un)" != "dvrango" ]; then
  echo "Este script corre en el minipc como dvrango, no en la Mac." >&2
  exit 1
fi

echo
echo "Setup del backup de Vichente en $(hostname)"
echo "Pide sudo una vez; el resto va solo."
sudo -v

# Mantiene vivo el sudo mientras dura la instalación, para que no vuelva a preguntar.
while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done 2>/dev/null &
MANTENER_SUDO=$!
trap 'kill "$MANTENER_SUDO" 2>/dev/null || true' EXIT

# --- 1. Cliente de Postgres 17 ---------------------------------------------

paso "Cliente de Postgres 17"
# Ubuntu 24.04 solo trae el 16; prod corre 17.6 y el cliente se usa para verificar
# restores. Viene del repo oficial de PostgreSQL.
if command -v psql >/dev/null && psql --version | grep -q ' 17'; then
  salta "ya instalado ($(psql --version))"
else
  sudo install -d /usr/share/postgresql-common/pgdg
  sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-client-17
  ok "$(psql --version)"
fi

# --- 2. jq ------------------------------------------------------------------

paso "jq"
if command -v jq >/dev/null; then
  salta "ya instalado"
else
  sudo apt-get install -y -qq jq && ok "instalado"
fi

# --- 3. rclone --------------------------------------------------------------

paso "rclone"
if command -v rclone >/dev/null; then
  salta "ya instalado ($(rclone version | head -1))"
else
  curl -fsSL https://rclone.org/install.sh | sudo bash
  ok "$(rclone version | head -1)"
fi

# --- 4. CLI de Supabase -----------------------------------------------------

paso "CLI de Supabase"
if command -v supabase >/dev/null; then
  salta "ya instalado (v$(supabase --version 2>/dev/null))"
else
  curl -fsSL -o /tmp/supabase.deb \
    https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb
  sudo dpkg -i /tmp/supabase.deb >/dev/null
  rm -f /tmp/supabase.deb
  ok "v$(supabase --version 2>/dev/null)"
fi

# --- 5. Enlace al proyecto --------------------------------------------------

paso "Enlace al proyecto de Supabase"
if [ ! -s "$ENV_FILE" ]; then
  echo "  ✗ falta $ENV_FILE con los secretos. Ver README.md." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

mkdir -p "$BASE"
cd "$BASE"
if [ -f "$BASE/supabase/.temp/project-ref" ]; then
  salta "ya enlazado a $(cat "$BASE/supabase/.temp/project-ref")"
else
  supabase init --workdir . </dev/null >/dev/null 2>&1 || true
  # El password de la DB se deja en blanco a propósito: el dump se autentica con
  # SUPABASE_ACCESS_TOKEN y provisiona su propio rol temporal.
  supabase link --project-ref "$PROJECT_REF" </dev/null
  ok "enlazado a $PROJECT_REF"
fi

# --- 6. Docker --------------------------------------------------------------

paso "Docker"
# `supabase db dump` corre pg_dump dentro de un contenedor: sin Docker no hay backup.
if ! command -v docker >/dev/null; then
  echo "  ✗ Docker no está instalado y el dump lo necesita." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "  ✗ Docker no responde. Probar: sudo systemctl start docker" >&2
  exit 1
fi
ok "corriendo, y dvrango está en el grupo docker"

# --- 7. Timer ---------------------------------------------------------------

paso "Timer de systemd"
sudo cp "$BASE/systemd/vichente-backup.service" /etc/systemd/system/
sudo cp "$BASE/systemd/vichente-backup.timer"   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vichente-backup.timer >/dev/null
ok "registrado y activo"

echo
systemctl list-timers vichente-backup.timer --no-pager | head -3
echo
echo "Listo. Primera corrida a mano (baja la imagen de postgres si falta):"
echo "  $BASE/bin/backup-prod.sh"
echo
