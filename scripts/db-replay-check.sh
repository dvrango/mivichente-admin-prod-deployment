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
REMOTO="$(ssh -o BatchMode=yes "$HOST" 'mktemp -d /tmp/vichente-replay.XXXXXX')"
# REMOTO va sin comillas dentro de los comandos remotos, `rm -rf` incluido: si el
# shell del minipc imprimiera algo más, aquí se corta antes de borrar lo que no es.
[[ "$REMOTO" =~ ^/tmp/vichente-replay\.[A-Za-z0-9]+$ ]] \
  || { echo "Error: mktemp en $HOST devolvió algo inesperado: $REMOTO" >&2; exit 1; }
# `|| true`: si la limpieza falla, no debe cambiar el resultado del replay.
trap 'ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" "rm -rf -- $REMOTO" || true' EXIT

echo
echo "Reconstruyendo la DB con $total migraciones en $HOST …"

# El tar de macOS agrega xattrs (com.apple.provenance) y archivos `._*` de
# AppleDouble. COPYFILE_DISABLE evita los `._*`, que el CLI intenta leer como
# migraciones, y --warning calla al GNU tar del minipc, que no reconoce los xattrs.
COPYFILE_DISABLE=1 tar -C "$SUPABASE_DIR" -cf - config.toml migrations \
  | ssh "$HOST" "mkdir -p $REMOTO/supabase && tar --warning=no-unknown-keyword -C $REMOTO/supabase -xf -"

# El SQL del diff sale por stdout; el progreso, los avisos del CLI y los errores, por
# stderr. Se guardan aparte para no confundir un aviso con una diferencia de schema.
# timeout: sin tty, un Ctrl-C local no llega al proceso remoto, que seguiría vivo
# ocupando el shadow_port (54320) y haría fallar la siguiente corrida.
codigo=0
ssh "$HOST" "cd $REMOTO && PATH=$PATH_REMOTO timeout 900 supabase db diff --db-url '$DB_LOCAL' --schema public >diff.sql 2>diff.err" \
  || codigo=$?

if [ "$codigo" -eq 255 ]; then
  echo "Error: se cayó la conexión SSH con $HOST a media corrida. No se sabe si las migraciones pasan." >&2
  exit 1
fi

if [ "$codigo" -eq 0 ]; then
  echo "✓ Las $total migraciones reconstruyen la DB sin error."
  diff_sql="$(ssh "$HOST" "cat $REMOTO/diff.sql")"
  if [ -n "$diff_sql" ]; then
    echo
    echo "La DB local tiene diferencias con lo que reconstruyen las migraciones:"
    printf '%s\n' "$diff_sql"
  fi
  exit 0
fi

errores="$(ssh "$HOST" "cat $REMOTO/diff.err")"
if [ "$codigo" -eq 124 ]; then
  echo "✗ FALLÓ: el replay pasó de 15 minutos y se cortó." >&2
else
  # Si el error no viene de una migración (por ejemplo, el shadow_port ocupado por
  # otra corrida), la última línea de "Applying migration" no aparece o no es la culpable.
  echo "✗ FALLÓ el replay (exit $codigo). Revisa si el error es de una migración o del entorno." >&2
fi
echo >&2
printf '%s\n' "$errores" | grep '^Applying migration' | tail -1 >&2 || true
printf '%s\n' "$errores" | grep -A8 'ERROR' >&2 || printf '%s\n' "$errores" | tail -15 >&2
exit 1
