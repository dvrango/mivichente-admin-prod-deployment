#!/usr/bin/env bash
#
# Aplica a la DB local las migraciones pendientes de supabase/migrations/.
#
#   npm run db:migrate:local [-- <flags de supabase migration up>]
#
# Antes corre db:local:check: si la DB local tiene la migración de otra rama, no aplica
# nada (las tareas con migración van una a la vez). La URL sale de LOCAL_DATABASE_URL
# (ver db-local-url.mjs), que solo acepta hosts locales.
#
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"

node "$AQUI/db-local-check.mjs"

DB_LOCAL="$(node "$AQUI/db-local-url.mjs")"
# Una URL vacía haría que el CLI buscara otra base por su cuenta.
[ -n "$DB_LOCAL" ] || { echo "✗ No se pudo leer la URL de la DB local (db-local-url.mjs no imprimió nada)." >&2; exit 1; }

# "$@": `npm run db:migrate:local -- --include-all` le llega al CLI.
PGSSLMODE=disable supabase migration up --db-url "$DB_LOCAL" "$@"
