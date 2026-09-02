#!/usr/bin/env bash
#
# Verifica que un backup sea restaurable: baja un dump de R2, lo carga en una base
# de PRUEBA y cuenta los negocios. Un backup que nunca se restauró no es un backup.
#
#   ./restore-check.sh                      # el backup más reciente
#   ./restore-check.sh --fecha 2026-08-27   # uno específico
#   ./restore-check.sh --esperado 587       # falla si no coincide el conteo
#
# ALCANCE: comprueba que la data está completa y es cargable. NO reconstruye un
# Supabase funcional — eso es el restore de verdad, documentado en README.md.
#
set -euo pipefail

# Igual que backup-prod.sh: no depender del PATH de quien invoca (systemd, ssh no
# interactivo, npm run). psql y rclone viven fuera del PATH mínimo.
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH:/usr/lib/postgresql/17/bin"

R2_BUCKET="vichente-backups"
ENV_FILE="${VICHENTE_BACKUP_ENV:-$HOME/.config/vichente-backup/env}"

# El cluster de Postgres donde se crea la base de prueba. Por defecto el del minipc.
# Nunca se toca la base `postgres`: esa es la DB de desarrollo local.
PG_HOST="${VICHENTE_PG_HOST:-100.96.221.80}"
PG_PORT="${VICHENTE_PG_PORT:-54322}"
PG_USER="${VICHENTE_PG_USER:-postgres}"
PG_PASS="${VICHENTE_PG_PASS:-postgres}"
DB_PRUEBA="vichente_restore_test"

FECHA=""
ESPERADO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --fecha)    FECHA="$2";    shift 2 ;;
    --esperado) ESPERADO="$2"; shift 2 ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

# --- Configuración ---------------------------------------------------------

[ -f "$ENV_FILE" ] || { echo "Error: no existe $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

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

export PGPASSWORD="$PG_PASS"
export PGSSLMODE=disable
PSQL_BASE=(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -v ON_ERROR_STOP=1 -q)

# --- Elegir y bajar el backup ----------------------------------------------

if [ -z "$FECHA" ]; then
  FECHA="$(rclone lsf "r2:${R2_BUCKET}/db/" --dirs-only | sed 's#/$##' | sort | tail -1)"
  [ -n "$FECHA" ] || { echo "Error: no hay backups en r2:${R2_BUCKET}/db/" >&2; exit 1; }
fi
log "Verificando el backup del $FECHA"

rclone copy "r2:${R2_BUCKET}/db/${FECHA}/" "$TMPDIR" --stats-one-line
for f in roles.sql.gz schema.sql.gz data.sql.gz; do
  [ -f "$TMPDIR/$f" ] || { echo "Error: al backup del $FECHA le falta $f" >&2; exit 1; }
done
gzip -d "$TMPDIR"/*.sql.gz

# --- Base de prueba limpia -------------------------------------------------

log "Recreando la base de prueba $DB_PRUEBA …"
"${PSQL_BASE[@]}" -d postgres -c "drop database if exists \"$DB_PRUEBA\" with (force);"
"${PSQL_BASE[@]}" -d postgres -c "create database \"$DB_PRUEBA\";"

PSQL_PRUEBA=("${PSQL_BASE[@]}" -d "$DB_PRUEBA")

# El dump de `public` referencia schemas que Supabase administra por fuera (auth,
# storage) y que una base nueva no tiene. Se crean como stubs para que las claves
# foráneas resuelvan; no se restaura `auth` de verdad, es data que se re-registra sola.
#
# Las extensiones son obligatorias, no un detalle: el dump NO incluye `unaccent`, y
# `businesses` la usa en una columna generada. Sin ella el CREATE TABLE falla y se
# cae en cascada todo lo que depende de esa tabla.
"${PSQL_PRUEBA[@]}" <<'SQL'
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create extension if not exists "unaccent"  with schema "public";
create extension if not exists "pg_trgm"   with schema "public";
create extension if not exists "pgcrypto"  with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";
create table if not exists auth.users (id uuid primary key);
-- Las políticas RLS del dump llaman a estas funciones. Sin ellas las policies no se
-- crean; no afecta el conteo de data, pero deja el schema más fiel al de prod.
create or replace function auth.uid()  returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select null::text $$;
create or replace function auth.jwt()  returns jsonb language sql stable as $$ select null::jsonb $$;
SQL

# --- Cargar ----------------------------------------------------------------

# El dump fija `search_path` vacío para que todo quede calificado. Pero `businesses`
# tiene una columna generada que llama a `immutable_unaccent`, y esa función está
# definida sin calificar el schema (`SELECT unaccent('unaccent', $1)`). En prod resuelve
# porque la sesión sí trae `public` en el path; con el path vacío no, y el CREATE TABLE
# se cae arrastrando todo lo que depende de la tabla. Aquí se le devuelve un path usable.
sed "s/^SELECT pg_catalog.set_config('search_path', '', false);/SELECT pg_catalog.set_config('search_path', 'public, extensions', false);/" \
  "$TMPDIR/schema.sql" > "$TMPDIR/schema-local.sql"

# ON_ERROR_STOP=0 a propósito: el schema trae GRANTs, publicaciones y extensiones que
# sólo existen en la plataforma de Supabase y fallan aquí sin que eso invalide la data.
log "Cargando roles y schema (se esperan errores de plataforma) …"
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$DB_PRUEBA" -q -v ON_ERROR_STOP=0 \
  -f "$TMPDIR/roles.sql" -f "$TMPDIR/schema-local.sql" >/dev/null 2>"$TMPDIR/schema.err" || true

# Si la tabla no quedó, no tiene sentido cargar data: se muestra el error real y se corta.
# La consulta se captura aparte para distinguir "la tabla no existe" de "psql falló":
# metida directo en el `if`, un psql caído devuelve vacío y el script seguiría de largo
# como si todo hubiera salido bien.
if ! falta_tabla="$("${PSQL_PRUEBA[@]}" -tAc "select to_regclass('public.businesses') is null;")"; then
  echo "✗ FALLÓ: no se pudo consultar $DB_PRUEBA en $PG_HOST:$PG_PORT." >&2
  exit 1
fi

if [ "$falta_tabla" = "t" ]; then
  echo "✗ FALLÓ: el schema no creó public.businesses. Primeros errores:" >&2
  grep -E '^psql:.*ERROR' "$TMPDIR/schema.err" | head -10 >&2
  cp "$TMPDIR/schema.err" ./restore-check-schema.err 2>/dev/null || true
  exit 1
fi

log "Cargando data …"
# Mismo parche de search_path que en el schema: la columna generada `name_normalized`
# se evalúa fila por fila durante el COPY, así que sin path usable el COPY de
# `businesses` falla entero y la tabla queda vacía.
sed "s/^SELECT pg_catalog.set_config('search_path', '', false);/SELECT pg_catalog.set_config('search_path', 'public, extensions', false);/" \
  "$TMPDIR/data.sql" > "$TMPDIR/data-local.sql"

# session_replication_role=replica desactiva triggers y FKs durante la carga, para que
# el orden de las tablas no importe y las referencias a auth.users no la tumben.
# Los COPY de `auth.*` y `storage.*` fallan aquí a propósito: esas tablas son de la
# plataforma y no se recrean en la base de prueba.
{ echo "set session_replication_role = replica;"; cat "$TMPDIR/data-local.sql"; } \
  | "${PSQL_PRUEBA[@]}" -v ON_ERROR_STOP=0 >/dev/null 2>"$TMPDIR/data.err" || true

# --- Verificar -------------------------------------------------------------

negocios="$("${PSQL_PRUEBA[@]}" -tAc 'select count(*) from public.businesses;')"
categorias="$("${PSQL_PRUEBA[@]}" -tAc 'select count(*) from public.categories;' 2>/dev/null || echo '?')"

echo
echo "  Backup:     $FECHA"
echo "  Negocios:   $negocios"
echo "  Categorías: $categorias"
echo "  Base:       $DB_PRUEBA en $PG_HOST:$PG_PORT"
echo

if [ "$negocios" -lt 1 ]; then
  echo "✗ FALLÓ: la tabla businesses quedó vacía. Errores en $TMPDIR/data.err" >&2
  cp "$TMPDIR/data.err" "./restore-check-data.err" 2>/dev/null || true
  exit 1
fi

if [ -n "$ESPERADO" ] && [ "$negocios" -ne "$ESPERADO" ]; then
  echo "✗ FALLÓ: se esperaban $ESPERADO negocios y se restauraron $negocios." >&2
  exit 1
fi

echo "✓ El backup del $FECHA es restaurable: $negocios negocios cargados."
