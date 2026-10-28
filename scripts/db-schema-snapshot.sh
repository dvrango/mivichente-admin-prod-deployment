#!/usr/bin/env bash
#
# Exporta el schema de la DB local del minipc a db/schema/: un archivo SQL por tabla,
# función y tipo, con policies, grants e índices. Es solo para leer. Las migraciones
# de supabase/migrations/ siguen siendo la fuente de verdad y se escriben a mano.
#
#   npm run db:schema:snapshot   regenera db/schema/
#   npm run db:schema:check      regenera en una carpeta temporal y falla si difiere
#
# Corre desde la Mac sin Docker: `declarative generate` solo lee la DB por la red.
#
# El snapshot refleja la DB LOCAL. Si hay una migración aplicada a local que todavía
# no tiene `db:push`, el snapshot ya la trae, aunque prod no la tenga.
#
# La DB local es una sola para todas las ramas. Si otra rama ya aplicó su migración, o
# alguien cambió algo a mano, el snapshot lo trae también. Antes de commitearlo, revisar
# que `git diff db/schema` solo tenga lo de la migración de esta rama. `db:replay:check`
# muestra lo que local tiene fuera de las migraciones (solo de `public`).
#
set -euo pipefail

# `declarative generate` es experimental y su formato cambia entre versiones del CLI
# (la 2.120 ya marca este formato como «legacy»). Con otra versión, el check daría diff
# de formato que no es cambio de schema. Al subir de versión: actualizar esta línea y
# regenerar el snapshot en el mismo commit.
CLI_VERSION="2.116.0"

AQUI="$(cd "$(dirname "$0")" && pwd)"
ADMIN="$(cd "$AQUI/.." && pwd)"
DESTINO="$ADMIN/db/schema"
# connect_timeout: sin él, un minipc inalcanzable deja el comando colgado y callado.
DB_LOCAL='postgresql://postgres:postgres@100.96.221.80:54322/postgres?sslmode=disable&connect_timeout=10'

modo="snapshot"
case "${1:-}" in
  "") ;;
  --check) modo="check" ;;
  *) echo "Opción desconocida: $1. Uso: $0 [--check]" >&2; exit 1 ;;
esac

# El aviso de versión nueva sale por stderr; la versión, en la primera línea de stdout.
version="$(supabase --version 2>/dev/null | head -1 || true)"
if [ "$version" != "$CLI_VERSION" ]; then
  echo "Error: el snapshot se genera con el CLI de Supabase $CLI_VERSION y aquí hay '${version:-ninguno}'." >&2
  echo "Instala esa versión, o sube CLI_VERSION en $0 y regenera el snapshot en el mismo commit." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# El comando escribe cache en <workdir>/supabase/.temp/. Con un workdir temporal no se
# mezcla con el cache que usan `db push` y `link` en supabase/.temp/ del repo.
mkdir -p "$TMP/workdir/supabase"
cp "$ADMIN/supabase/config.toml" "$TMP/workdir/supabase/"

if ! supabase db schema declarative generate --experimental \
  --db-url "$DB_LOCAL" \
  --schema public \
  --output-dir "$TMP/schema" \
  --workdir "$TMP/workdir" >"$TMP/generate.log" 2>&1; then
  echo "✗ Falló la exportación del schema. ¿Está prendida la DB local del minipc?" >&2
  cat "$TMP/generate.log" >&2
  exit 1
fi

if [ "$modo" = "check" ]; then
  if [ ! -d "$DESTINO" ]; then
    echo "✗ No existe $DESTINO. Corre npm run db:schema:snapshot." >&2
    exit 1
  fi
  codigo=0
  diff -ru "$DESTINO" "$TMP/schema" >"$TMP/schema.diff" 2>&1 || codigo=$?
  if [ "$codigo" -eq 0 ]; then
    echo "✓ db/schema/ coincide con la DB local."
    exit 0
  fi
  if [ "$codigo" -ne 1 ]; then
    # 2 = diff no pudo leer algo. No es una diferencia de schema: regenerar no lo arregla.
    echo "✗ diff falló (exit $codigo) al comparar db/schema/:" >&2
    cat "$TMP/schema.diff" >&2
    exit 1
  fi
  # El diff va de lo versionado (---) a lo que hay en la DB local (+++).
  cat "$TMP/schema.diff"
  echo >&2
  echo "✗ db/schema/ no coincide con la DB local. Si aplicaste una migración, corre npm run db:schema:snapshot y commitea el resultado." >&2
  exit 1
fi

# Se reemplaza la carpeta completa para que una tabla o función borrada también
# desaparezca del snapshot. Antes se comprueba que el export trajo algo: si el CLI
# saliera con 0 sin escribir, el `rm` dejaría al repo sin snapshot.
if [ ! -f "$TMP/schema/.pgdelta-export.json" ]; then
  echo "✗ El CLI terminó sin escribir el export; db/schema/ no se tocó." >&2
  cat "$TMP/generate.log" >&2
  exit 1
fi
rm -rf "$DESTINO"
mkdir -p "$(dirname "$DESTINO")"
mv "$TMP/schema" "$DESTINO"
echo "✓ Snapshot escrito en db/schema/ ($(find "$DESTINO" -type f | wc -l | tr -d ' ') archivos)."
