#!/usr/bin/env bash
#
# Copia diaria del catálogo de prod a la DB local del minipc: baja el dump de HOY de
# R2 y recarga en la base `postgres` solo las tablas de catálogo y configuración.
# Corre en el minipc por systemd timer, después del backup. Ver README.md.
#
#   ./refresh-local.sh                      # el backup de hoy
#   ./refresh-local.sh --fecha 2026-10-10   # uno específico (para correrlo a mano)
#
# Qué NO hace, a propósito:
#   - No toca el schema. Lo siguen mandando las migraciones del repo, así que las que
#     van adelante de prod siguen aplicadas y `supabase_migrations` no cambia.
#   - No toca `auth`, `storage` ni `profiles`: las cuentas locales quedan intactas.
#     Los `created_by`/`updated_by` que apuntan a perfiles de prod quedan colgando
#     (decisión del 2026-10-10, tarea x8bfbgvw6); el log dice cuántos.
#   - No copia telemetría ni datos personales (ver EXCLUIDAS).
#
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH:/usr/lib/postgresql/17/bin"

R2_BUCKET="vichente-backups"
ENV_FILE="${VICHENTE_BACKUP_ENV:-$HOME/.config/vichente-backup/env}"
PAUSA="${VICHENTE_REFRESH_PAUSA:-$HOME/vichente-backup/refresh.pausa}"

PG_HOST="${VICHENTE_PG_HOST:-100.96.221.80}"
PG_PORT="${VICHENTE_PG_PORT:-54322}"
PG_USER="${VICHENTE_PG_USER:-postgres}"
PG_PASS="${VICHENTE_PG_PASS:-postgres}"
PG_DB="${VICHENTE_PG_DB:-postgres}"

# Tablas que se copian de prod. Lista fija: una tabla nueva de catálogo NO entra sola,
# hay que agregarla aquí (el script avisa si encuentra una que no está en ninguna lista).
COPIADAS=(
  categories
  businesses
  business_categories
  business_hours
  business_photos
  business_slug_history
  business_services
  business_service_variants
  business_service_option_groups
  business_service_options
  bus_schedules
)

# Tablas que existen pero no se copian.
#   Telemetría: voluminosa, personal y no hace falta para probar. Además las pruebas no
#   deben mezclarse con datos de prod.
#   profiles: ver arriba.
#   business_owner_contacts, business_registrations, business_reports: datos personales
#   de dueños y de quien llenó un formulario. No hacen falta para probar la app.
#   _backup_businesses_fase1: tabla suelta que solo existe en local.
EXCLUIDAS=(
  search_events
  search_result_taps
  qr_scans
  business_contacts
  order_funnel_events
  excluded_devices
  profiles
  business_owner_contacts
  business_registrations
  business_reports
  _backup_businesses_fase1
)

# Tablas que el `truncate … cascade` vacía porque tienen FK a una tabla copiada. Se
# vacían en local en cada copia. Si una migración agrega otra (una FK nueva a
# `businesses`), la copia falla ANTES de truncar y pide agregarla aquí a propósito:
# no se vacía nada que nadie haya decidido vaciar. `profiles` nunca puede estar aquí.
SE_VACIAN=(
  search_result_taps
  business_contacts
  order_funnel_events
  qr_scans
  business_reports
  business_registrations
  business_owner_contacts
)

FECHA="$(date +%Y-%m-%d)"
while [ $# -gt 0 ]; do
  case "$1" in
    --fecha) FECHA="$2"; shift 2 ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done

TMPDIR="$(mktemp -d)"
PASO="arranque"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

notificar() {
  local texto="$1"
  if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
    log "(sin DISCORD_WEBHOOK_URL, no se notifica)"
    return 0
  fi
  jq -Rn --arg c "$texto" '{content: $c}' \
    | curl -sf -X POST -H 'Content-Type: application/json' -d @- "$DISCORD_WEBHOOK_URL" >/dev/null \
    || log "ADVERTENCIA: no se pudo notificar a Discord"
}

# Falla dura: la carga va en una sola transacción, así que si algo truena la DB local
# queda exactamente como estaba.
# Después de la carga ya no aplica "quedó como estaba": ESTADO_DB lo corrige.
ESTADO_DB="La DB local quedó como estaba."
fallar() {
  local motivo="$1"
  log "FALLÓ en el paso: $PASO — $motivo"
  notificar "🔴 **Copia de prod a la DB local falló**
Paso: \`$PASO\`
$motivo
$ESTADO_DB Backup: \`$FECHA\` · host \`$(hostname)\`
Revisar: \`journalctl -u vichente-refresh-local.service -n 50\`"
  rm -rf "$TMPDIR"
  exit 1
}
trap 'fallar "error inesperado (exit $?)"' ERR
# systemd manda SIGTERM al cumplirse TimeoutStartSec. Sin esto bash muere callado.
# Si estaba a media carga, Postgres revierte la transacción al cortarse la conexión.
trap 'fallar "interrumpido por SIGTERM (¿timeout de systemd?)"' TERM
trap 'rm -rf "$TMPDIR"' EXIT

en_lista() {
  local x="$1"; shift
  local y
  for y in "$@"; do [ "$x" = "$y" ] && return 0; done
  return 1
}

# --- Pausa -----------------------------------------------------------------

# Para no borrar a las 4 am una prueba larga en la DB local (una migración a medias,
# datos sembrados a mano). `touch` del archivo pausa la copia hasta que se borre.
if [ -e "$PAUSA" ]; then
  log "Pausado: existe $PAUSA. No se toca la DB local."
  exit 0
fi

# --- Configuración ---------------------------------------------------------

PASO="cargar configuración"
[ -f "$ENV_FILE" ] || fallar "no existe $ENV_FILE"
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
# Esta copia TRUNCA el destino. Nunca contra Supabase cloud, aunque alguien reuse las
# variables VICHENTE_PG_* que restore-check.sh documenta para apuntar a otro cluster.
case "$PG_HOST" in
  *supabase.co*|*supabase.com*|*pooler*) fallar "\`$PG_HOST\` no es la DB local. Esta copia trunca el destino." ;;
esac
# Validar antes de usarlas: con `set -u` una variable faltante aborta sin pasar por
# el trap ERR, y la falla no llegaría a Discord.
for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [ -n "${!var:-}" ] || fallar "falta $var en $ENV_FILE"
done

export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

export PGPASSWORD="$PG_PASS"
export PGSSLMODE=disable
PSQL=(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -q -X)

# --- Bajar el dump ---------------------------------------------------------

# Solo el de la fecha pedida. Si el backup de hoy falló o va tarde, cargar el de ayer
# en silencio haría creer que la DB local está al día cuando no.
PASO="bajar el backup del $FECHA"
log "Bajando data.sql del $FECHA …"
rclone copy "r2:${R2_BUCKET}/db/${FECHA}/data.sql.gz" "$TMPDIR" --stats-one-line 2>"$TMPDIR/rclone.err" || true
if [ ! -s "$TMPDIR/data.sql.gz" ]; then
  # rclone sale bien cuando el archivo no existe, y mal cuando la falla es suya
  # (credenciales, red). Distinguirlo evita culpar al backup de algo que no hizo.
  if [ -s "$TMPDIR/rclone.err" ] && grep -q ERROR "$TMPDIR/rclone.err"; then
    fallar "rclone no pudo leer R2: $(grep -m1 ERROR "$TMPDIR/rclone.err")"
  fi
  fallar "No hay \`db/${FECHA}/data.sql.gz\` en R2 (¿el backup de hoy falló o no ha corrido?)."
fi
gzip -d "$TMPDIR/data.sql.gz"

# --- Tablas que no están en ninguna lista ----------------------------------

PASO="revisar tablas sin clasificar"
tablas_dump="$(awk '/^COPY "public"\./ { t = $2; gsub(/"public"\.|"/, "", t); print t }' "$TMPDIR/data.sql" | sort -u)"
tablas_local="$("${PSQL[@]}" -tAc "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') order by 1;")"

sin_clasificar=()
for t in $(printf '%s\n%s\n' "$tablas_dump" "$tablas_local" | sort -u); do
  en_lista "$t" "${COPIADAS[@]}" || en_lista "$t" "${EXCLUIDAS[@]}" || sin_clasificar+=("$t")
done

# Una tabla de COPIADAS que ya no existe en local (migración que la borró o renombró)
# no se puede cargar: falla dura, antes de truncar nada.
for t in "${COPIADAS[@]}"; do
  printf '%s\n' "$tablas_local" | grep -qx "$t" || fallar "La tabla \`$t\` está en la lista de copia pero no existe en la DB local."
done

# Una tabla de COPIADAS que no viene en el dump se truncaría y quedaría vacía con
# conteos "correctos" (0 = 0). Pasaría si el CLI de Supabase cambia el formato del
# dump y deja de entrecomillar `"public"."x"`. Falla dura, antes de truncar.
PASO="revisar el dump"
for t in "${COPIADAS[@]}"; do
  printf '%s\n' "$tablas_dump" | grep -qx "$t" || fallar "La tabla \`$t\` no viene en el dump (¿cambió el formato del dump?)."
done

# Filas por tabla en el dump. Se comparan DENTRO de la transacción de carga, así un
# descuadre la revierte en vez de dejar la DB local a medias.
declare -A esperado
for t in "${COPIADAS[@]}"; do
  esperado[$t]="$(awk -v t="$t" '
    /^COPY "public"\./ { x = $2; gsub(/"public"\.|"/, "", x); dentro = (x == t); next }
    dentro && $0 == "\\." { dentro = 0 }
    dentro { n++ }
    END { print n + 0 }
  ' "$TMPDIR/data.sql")"
done
[ "${esperado[businesses]}" -gt 0 ] || fallar "El dump trae 0 negocios."

# --- Alcance del truncate ----------------------------------------------------

# `truncate … cascade` vacía toda tabla con FK (directa o en cadena) a una copiada,
# sin importar su `on delete`. Se calcula antes de truncar y se exige que esté en
# COPIADAS o SE_VACIAN: una FK nueva no puede vaciar una tabla en silencio.
PASO="revisar alcance del truncate"
lista_sql="$(printf "'public.%s'::regclass," "${COPIADAS[@]}")"
lista_sql="${lista_sql%,}"
alcance="$("${PSQL[@]}" -tAc "
  with recursive r(t) as (
    select unnest(array[$lista_sql])
    union
    select c.conrelid::regclass from pg_constraint c join r on c.confrelid = r.t where c.contype = 'f'
  )
  select distinct c.relname from r join pg_class c on c.oid = r.t order by 1;")"
for t in $alcance; do
  [ "$t" = profiles ] && fallar "El truncate alcanzaría \`profiles\` (cuentas locales). Revisar la FK nueva."
  en_lista "$t" "${COPIADAS[@]}" || en_lista "$t" "${SE_VACIAN[@]}" \
    || fallar "El truncate vaciaría \`$t\`, que no está en SE_VACIAN. Si es correcto vaciarla en cada copia, agregarla ahí."
done

# --- Armar el SQL ----------------------------------------------------------

PASO="armar el SQL de carga"
# Solo los bloques COPY de las tablas permitidas. El resto del dump (auth, storage,
# telemetría, setval de auth) no se manda.
lista_awk="$(IFS=,; echo "${COPIADAS[*]}")"
awk -v lista="$lista_awk" '
  BEGIN { n = split(lista, a, ","); for (i = 1; i <= n; i++) ok[a[i]] = 1 }
  /^COPY "public"\./ {
    t = $2; gsub(/"public"\.|"/, "", t)
    if (t in ok) { dentro = 1; print; next }
  }
  dentro { print; if ($0 == "\\.") dentro = 0 }
' "$TMPDIR/data.sql" > "$TMPDIR/copias.sql"

truncar=""
for t in "${COPIADAS[@]}"; do truncar+="public.\"$t\", "; done
truncar="${truncar%, }"

# - session_replication_role = replica: el orden de carga no importa y las FK a
#   `profiles` de prod no tumban la carga (opción A).
# - search_path con `public`: la columna generada `businesses.name_normalized` llama a
#   `immutable_unaccent` sin calificar el schema. Con el path vacío del dump, el COPY de
#   `businesses` falla entero (ver README, restore).
# - truncate … cascade vacía también las tablas que referencian a las copiadas
#   (telemetría, reportes, registros, contactos de dueños). Es lo esperado: en local
#   no deben quedar filas que apunten a negocios que ya no existen.
# - lock_timeout: el truncate pide ACCESS EXCLUSIVE. Detrás de una sesión colgada
#   `idle in transaction` esperaría hasta el timeout de systemd bloqueando las lecturas.
{
  echo "set session_replication_role = replica;"
  echo "set lock_timeout = '30s';"
  echo "select pg_catalog.set_config('search_path', 'public, extensions', false);"
  echo "truncate $truncar restart identity cascade;"
  cat "$TMPDIR/copias.sql"
  echo "do \$\$ declare n bigint; begin"
  for t in "${COPIADAS[@]}"; do
    echo "  select count(*) into n from public.\"$t\";"
    echo "  if n <> ${esperado[$t]} then raise exception 'conteo de $t: dump ${esperado[$t]}, cargadas %', n; end if;"
  done
  echo "end \$\$;"
} > "$TMPDIR/carga.sql"

# --- Cargar ----------------------------------------------------------------

PASO="cargar en la DB local"
log "Cargando ${#COPIADAS[@]} tablas en $PG_DB@$PG_HOST:$PG_PORT …"
if ! "${PSQL[@]}" --single-transaction -f "$TMPDIR/carga.sql" >"$TMPDIR/carga.out" 2>"$TMPDIR/carga.err"; then
  fallar "psql: $(grep -m1 -E 'ERROR' "$TMPDIR/carga.err" || head -1 "$TMPDIR/carga.err")"
fi

# --- Resumen ---------------------------------------------------------------

# Los conteos ya se verificaron dentro de la transacción. Esto solo arma el log.
PASO="resumen"
ESTADO_DB="La carga ya se hizo y sus conteos cuadraron; falló solo el resumen."
negocios="$("${PSQL[@]}" -tAc 'select count(*) from public.businesses;')"

colgando="$("${PSQL[@]}" -tAc "
  select count(*) from (
    select created_by as p from public.businesses
    union all select updated_by from public.businesses
    union all select created_by from public.business_services
    union all select updated_by from public.business_services
    union all select created_by from public.business_service_variants
    union all select updated_by from public.business_service_variants
    union all select created_by from public.business_service_option_groups
    union all select updated_by from public.business_service_option_groups
    union all select created_by from public.business_service_options
    union all select updated_by from public.business_service_options
  ) x
  where p is not null and not exists (select 1 from public.profiles where id = x.p);")"

trap - ERR

if [ "${#sin_clasificar[@]}" -gt 0 ]; then
  log "AVISO: tablas sin clasificar: ${sin_clasificar[*]}"
  notificar "🟠 **Copia de prod a la DB local: tablas sin clasificar**
La copia del \`$FECHA\` sí corrió, pero estas tablas de \`public\` no están ni en la lista de copia ni en la de excluidas, así que no se copiaron:
\`${sin_clasificar[*]}\`
Agregarlas a \`COPIADAS\` o \`EXCLUIDAS\` en \`refresh-local.sh\`."
fi

log "✓ Copia del $FECHA en la DB local: $negocios negocios · ${#COPIADAS[@]} tablas · $colgando referencias a perfiles de prod colgando"
