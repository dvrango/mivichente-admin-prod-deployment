#!/usr/bin/env bash
#
# Comprueba que las migraciones de supabase/migrations/ reconstruyen la DB desde cero,
# sin tocar la DB local del minipc.
#
# `supabase db diff` arma una DB shadow nueva y desechable aplicando todas las
# migraciones en orden, y después la compara contra la DB local, que solo lee. Si una
# migración truena, el diff falla. La shadow necesita Docker, que la Mac no tiene:
# por eso corre en el minipc, sobre una copia temporal de supabase/ que se borra al
# terminar.
#
# El diff que imprime cuando todo pasa es lo que la DB local tiene distinto de lo que
# reconstruyen las migraciones: cambios hechos a mano o restos que nadie migró.
#
set -euo pipefail

HOST="${VICHENTE_MINIPC_HOST:-minipc}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
SUPABASE_DIR="$AQUI/../supabase"
# El CLI vive en linuxbrew, que no está en el PATH de una sesión SSH no interactiva.
PATH_REMOTO='/home/linuxbrew/.linuxbrew/bin:/usr/local/bin:/usr/bin:/bin'
# Visto desde el minipc: la DB local corre ahí mismo.
DB_LOCAL='postgresql://postgres:postgres@localhost:54322/postgres?sslmode=disable'

ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" true 2>/dev/null \
  || { echo "Error: no hay SSH a '$HOST'. Revisa ~/.ssh/config." >&2; exit 1; }

total="$(find "$SUPABASE_DIR/migrations" -name '*.sql' | wc -l | tr -d ' ')"
REMOTO="$(ssh "$HOST" 'mktemp -d /tmp/vichente-replay.XXXXXX')"
trap 'ssh "$HOST" "rm -rf $REMOTO"' EXIT

echo
echo "Reconstruyendo la DB con $total migraciones en $HOST …"

# El tar de macOS agrega xattrs (com.apple.provenance) y archivos `._*` de
# AppleDouble. COPYFILE_DISABLE evita los `._*`, que el CLI intenta leer como
# migraciones, y --warning calla al GNU tar del minipc, que no reconoce los xattrs.
COPYFILE_DISABLE=1 tar -C "$SUPABASE_DIR" -cf - config.toml migrations \
  | ssh "$HOST" "mkdir -p $REMOTO/supabase && tar --warning=no-unknown-keyword -C $REMOTO/supabase -xf -"

if salida="$(ssh "$HOST" "cd $REMOTO && PATH=$PATH_REMOTO supabase db diff --db-url '$DB_LOCAL' --schema public 2>&1")"; then
  echo "✓ Las $total migraciones reconstruyen la DB sin error."
  # Lo que imprime antes de "Finished" es progreso (shadow, migraciones, docker pull).
  diff_sql="$(printf '%s\n' "$salida" | awk 'listo && NF; /^Finished supabase db diff/ {listo=1}')"
  if [ -n "$diff_sql" ]; then
    echo
    echo "La DB local tiene diferencias con lo que reconstruyen las migraciones:"
    printf '%s\n' "$diff_sql"
  fi
  exit 0
fi

echo "✗ FALLÓ: las migraciones no reconstruyen la DB." >&2
echo >&2
printf '%s\n' "$salida" | grep '^Applying migration' | tail -1 >&2
printf '%s\n' "$salida" | grep -A8 'ERROR' >&2 || printf '%s\n' "$salida" | tail -15 >&2
exit 1
