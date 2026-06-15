#!/bin/sh
# Genera database.types.ts desde postgres-meta del minipc local (sin Docker).
# Lee NEXT_PUBLIC_SUPABASE_ANON_KEY de .env.local y la LOCAL_SUPABASE_META_URL de .env.local.
set -e

ENV_FILE="$(dirname "$0")/../.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.local no encontrado en $ENV_FILE" >&2
  exit 1
fi

ANON_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
META_URL=$(grep '^LOCAL_SUPABASE_META_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')

if [ -z "$ANON_KEY" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_ANON_KEY no encontrado en .env.local" >&2
  exit 1
fi

if [ -z "$META_URL" ]; then
  META_URL="http://100.96.221.80:54321"
fi

OUT="$(dirname "$0")/../src/lib/database.types.ts"

curl -sf "${META_URL}/pg/generators/typescript" \
  -H "apikey: ${ANON_KEY}" \
  > "$OUT"

echo "✓ Tipos generados en src/lib/database.types.ts"
