# Backup y restore de producción

Producción (Supabase free tier) no tiene backups administrados. Estos scripts los suplen: un dump diario de la base más un espejo de los buckets de Storage, ambos en Cloudflare R2.

**Si estás leyendo esto durante un incidente, salta a [Restaurar](#restaurar-de-verdad).**

## Qué se respalda

| Qué                          | Cómo                                                                              | Retención                  |
| ---------------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| Data de `public`             | Dump completo diario, comprimido                                                  | 30 días                    |
| Schema de `public`           | Dump diario (el estado real de prod, que puede haber divergido de las migrations) | 30 días                    |
| Roles del cluster            | Dump diario                                                                       | 30 días                    |
| Bucket `business-photos`     | Espejo incremental                                                                | vigente + papelera 90 días |
| Bucket `registration-photos` | Espejo incremental                                                                | vigente + papelera 90 días |

**Fuera de scope, a propósito:** el schema `auth` (los usuarios se re-registran solos, y restaurar `auth` es frágil), el proyecto v1 (`vichente-app`, congelado), y PITR.

El activo real son los negocios: levantamiento manual a partir de información pública, semanas de trabajo, y no existen en ninguna otra parte. El schema sí es reproducible desde las migrations en git.

## Dónde vive

Bucket R2 `vichente-backups`:

```
db/2026-08-27/roles.sql.gz
db/2026-08-27/schema.sql.gz
db/2026-08-27/data.sql.gz
storage/business-photos/…
storage/registration-photos/…
storage-papelera/2026-08-27/…     ← lo borrado o reemplazado en prod
```

El espejo **nunca borra**: lo que desaparece de prod se mueve a `storage-papelera/<fecha>/`. Un borrado accidental en producción no se propaga al backup.

> Esa papelera es la parte que más tarda en probarse, porque solo se ejercita cuando algo se borra en prod de verdad. La primera vez que pasó (2026-08-28) reventó con `403 AccessDenied`: el token de R2 no puede crear buckets y rclone verificaba el destino antes de escribir. Se resolvió con `RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true`. Si algún día se cambia de proveedor o de token, **esta es la ruta que hay que volver a probar a mano** — el camino feliz seguirá pasando aunque esté rota.

## Cómo corre

En el minipc, por systemd, todos los días a las 03:30. Con `Persistent=true`: si el minipc estaba apagado, corre al arrancar.

```bash
ssh minipc 'systemctl list-timers vichente-backup.timer'   # próxima corrida
ssh minipc 'sudo systemctl start vichente-backup.service'  # correr ahora
ssh minipc 'journalctl -u vichente-backup.service -n 50'   # qué pasó
```

Desde el repo, a mano — útil antes de un `npm run db:push`:

```bash
npm run db:backup
```

## Señales en Discord

- **Falla** → mensaje inmediato con el paso donde murió.
- **Rotación fallida** → aviso aparte. El backup sí se subió; lo que no corrió fue la limpieza. Se avisa porque si falla todas las noches, R2 crece sin que nadie se entere.
- **Domingos** → "sigo vivo": fecha, negocios, espacio, y **cuántos días de backup hay contra cuántos debería haber**. Si falta alguno, lo dice.

El heartbeat semanal no es adorno: si el timer deja de dispararse, no hay ningún error que reportar y el silencio parecería normal. La ausencia del mensaje del domingo es la única señal de que se rompió.

Y cuenta el historial, no solo la corrida de hoy, porque reportar "hoy corrí bien" alcanzaría para tapar que el martes no corrió: el mensaje del domingo llegaría igual de verde con un hueco en el historial.

Para probar esa rama sin esperar al domingo:

```bash
ssh minipc 'VICHENTE_FORZAR_HEARTBEAT=1 ~/vichente-backup/bin/backup-prod.sh'
```

## Verificar que el backup sirve

```bash
npm run db:restore:check                  # el más reciente
npm run db:restore:check -- --fecha 2026-08-27 --esperado 587
```

Baja el dump, lo carga en la base `vichente_restore_test` del minipc y cuenta los negocios. **No toca la base `postgres`**, que es la DB de desarrollo local.

Esto comprueba que la data está completa y es cargable. No reconstruye un Supabase funcional — para eso está el procedimiento de abajo.

## Copia diaria en la DB local

La DB local del minipc (`postgres` en `100.96.221.80:54322`) es el entorno de pruebas: no hay staging. Para que las pruebas, Playwright y los agentes no tengan que ir contra prod, `refresh-local.sh` le copia **cada día a las 04:15** el catálogo de prod del backup de ese día.

```bash
npm run db:refresh:local                                           # correr ahora (el backup de hoy)
ssh minipc '~/vichente-backup/bin/refresh-local.sh --fecha 2026-10-10'
ssh minipc 'journalctl -u vichente-refresh-local.service -n 20'    # qué pasó
```

**Qué copia** (lista `COPIADAS` del script): `categories`, `businesses`, `business_categories`, `business_hours`, `business_photos`, `business_slug_history`, `business_services`, `business_service_variants`, `business_service_option_groups`, `business_service_options`, `bus_schedules`.

**Qué no copia** (lista `EXCLUIDAS`):

- Telemetría: `search_events`, `search_result_taps`, `qr_scans`, `business_contacts`, `order_funnel_events`, `excluded_devices`. Es voluminosa, personal y no hace falta para probar.
- `profiles`, `auth` y `storage`: las cuentas locales (`admin@dvranlabs.com` y los reviewers de prueba) quedan intactas. Los `created_by`/`updated_by` de prod apuntan a perfiles que no existen en local; el log dice cuántos. Nada en el admin ni en mobile los usa para mostrar algo.
- Datos personales que no hacen falta para probar: `business_owner_contacts`, `business_registrations`, `business_reports`.
- `_backup_businesses_fase1`: tabla suelta que solo existe en local.

**Cómo carga:** baja `db/<hoy>/data.sql.gz`, toma solo los `COPY "public".<tabla>` de la lista y, en **una sola transacción**, hace `truncate … cascade` de esas tablas y las recarga. No toca el schema: lo siguen mandando las migraciones del repo, así que las migraciones locales que todavía no están en prod siguen aplicadas. Si algo falla, la transacción se revierte y la DB local queda como estaba.

Lo que hay que saber antes de usar la DB local:

- **El `truncate … cascade` vacía también las tablas que apuntan a negocios**: `search_result_taps`, `business_contacts`, `order_funnel_events`, `qr_scans`, `business_reports`, `business_registrations` y `business_owner_contacts`. Lo que una prueba haya escrito ahí se pierde en la siguiente copia. `search_events` no tiene FK a negocios y se conserva.
- **Las funciones de métricas del admin** (`admin_weekly_metrics`, `admin_top_zero_result_queries`) no tienen telemetría que leer. Quien las pruebe siembra sus propios eventos.
- **Las fotos se ven:** `photo_url` y `business_photos.url` guardan la URL absoluta del Storage público de prod, así que en local se cargan desde ahí. Bajar una imagen pública no escribe telemetría.
- **Una tabla nueva de catálogo no entra sola.** Si aparece en `public` una tabla que no está en `COPIADAS` ni en `EXCLUIDAS`, la copia corre igual pero avisa en Discord. Hay que agregarla a una de las dos listas.

**Pausarla** (por ejemplo, durante una prueba de migración que dura varios días):

```bash
ssh minipc 'touch ~/vichente-backup/refresh.pausa'   # pausar
ssh minipc 'rm ~/vichente-backup/refresh.pausa'      # reanudar
```

**Señales en Discord:** si falla, avisa con el paso donde murió (backup de hoy ausente, carga que truena o conteos que no cuadran con el dump). Si sale bien, no manda nada. El backup y su heartbeat no cambian.

### Apuntar las pruebas a la DB local

- **Web app de Flutter:** `env/dev.json` ya apunta a `http://100.96.221.80:54321`. En web va **sin** `--flavor`, así que no sirve `make run-dev`:

  ```bash
  cd mobile
  flutter run -d chrome --target lib/main_dev.dart --dart-define-from-file env/dev.json
  # o, para servirla estática y abrirla con Playwright:
  flutter build web --release --target lib/main_dev.dart --dart-define-from-file env/dev.json
  python3 -m http.server 8080 -d build/web
  ```

- **Playwright y agentes:** contra esa web app local (`http://127.0.0.1:8080/#/<slug>/menu`; `localhost` puede resolver a IPv6 y no conecta con `http.server`), **nunca** contra `app.vichente.com`. Cada sesión contra prod deja devices falsos en la telemetría.
- **Admin:** `npm run dev` ya usa la DB local (`.env.local`).

## Restaurar de verdad

Cuando prod se perdió o se corrompió. Toma unos 20 minutos.

### 1. Bajar el backup

```bash
set -a; . ~/.config/vichente-backup/env; set +a
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
       RCLONE_CONFIG_R2_REGION=auto \
       RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
       RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
       RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

rclone lsf r2:vichente-backups/db/                      # ver qué fechas hay
rclone copy r2:vichente-backups/db/2026-08-27/ ./restore/
gzip -d ./restore/*.gz
```

### 2. Levantar el schema desde git, no desde el dump

Es la vía limpia: las migrations son la fuente de verdad y dejan `supabase_migrations` consistente, así que los `db:push` futuros siguen funcionando.

```bash
# Crear el proyecto nuevo en el dashboard, luego:
cd admin/
supabase link --project-ref <REF_NUEVO>
npm run db:push
```

Si las migrations no aplican (prod había divergido), usar `schema.sql` del backup como plan B — pero entonces hay que reconciliar `supabase_migrations` a mano antes del siguiente push.

### 3. Cargar la data

**Antes de cargar, hay que neutralizar el `search_path` vacío del dump.** No es opcional: `businesses` tiene una columna generada (`name_normalized`) que llama a `immutable_unaccent`, y esa función está definida sin calificar el schema — `SELECT unaccent('unaccent', $1)`. Con el `search_path` en blanco que trae el dump, `unaccent` no resuelve, el `COPY` de `businesses` falla entero y la tabla queda vacía **sin que el comando devuelva error**. Es la trampa más cara de este backup: parece que cargó y no cargó.

```bash
sed "s/^SELECT pg_catalog.set_config('search_path', '', false);/SELECT pg_catalog.set_config('search_path', 'public, extensions', false);/" \
  ./restore/data.sql > ./restore/data-listo.sql

psql "<CONNECTION_STRING_DEL_PROYECTO_NUEVO>" \
  -c "set session_replication_role = replica;" \
  -f ./restore/data-listo.sql
```

`session_replication_role = replica` desactiva triggers y claves foráneas durante la carga, para que el orden de las tablas no importe.

Van a salir errores de `auth.*` y `storage.*`: el dump incluye esas tablas y en el proyecto nuevo las administra la plataforma. Es esperado, no invalida la carga de `public`.

### 4. Verificar

```bash
psql "<CONNECTION_STRING>" -c "select count(*) from businesses;"
```

Comparar contra el número que reportó el último heartbeat de Discord.

### 5. Restaurar las fotos

```bash
rclone sync r2:vichente-backups/storage/business-photos \
            supa_nuevo:business-photos
```

Con `supa_nuevo:` apuntando al endpoint S3 del proyecto nuevo (`https://<REF>.storage.supabase.co/storage/v1/s3`). Los buckets tienen que existir antes, con la misma visibilidad: `business-photos` público, `registration-photos` privado.

### 6. Reapuntar las apps

Actualizar URL y llaves de Supabase en `admin/.env.local` (y en Vercel), `landing/`, y `mobile/env/prod.json`. Redesplegar.

Los usuarios de `auth` no se restauran: se vuelven a registrar.

## Recuperar algo borrado por accidente

No hace falta restaurar todo.

**Una tabla:**

```bash
rclone copy r2:vichente-backups/db/<fecha>/data.sql.gz . && gzip -d data.sql.gz
awk '/^COPY "?public"?\."?businesses"?/,/^\\\.$/' data.sql > businesses.sql
# revisar businesses.sql antes de cargarlo contra prod
```

**Fotos borradas:** están en `storage-papelera/<fecha>/`, 90 días.

```bash
rclone lsf r2:vichente-backups/storage-papelera/
rclone copy r2:vichente-backups/storage-papelera/<fecha>/business-photos/<archivo> supa:business-photos/
```

## Setup

Dos pasos. Desde el repo, en la Mac:

```bash
npm run backup:deploy
```

Copia los scripts al minipc y reporta qué falta. Después, en el minipc:

```bash
ssh minipc
~/vichente-backup/bin/setup-minipc.sh
```

Instala dependencias, enlaza el proyecto de Supabase y registra el timer. Pide sudo una vez, al principio. Los dos scripts son idempotentes: correrlos de nuevo solo confirma el estado.

Lo único manual es el archivo de secretos, abajo.

**Por qué corre en el minipc y no en la Mac:** `supabase db dump` ejecuta `pg_dump` dentro de un contenedor, así que necesita Docker — que está en el minipc, no en la Mac. Además el minipc está siempre encendido, tiene 52 GB libres y corre Postgres 17.6, la misma versión que producción, lo que hace fiel la verificación de restores.

### Secretos

Viven en `~/.config/vichente-backup/env` **del minipc**, modo 0600, fuera de todo repo:

| Variable                                           | De dónde sale                                              |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`                            | Dashboard de Supabase → Account → Access Tokens            |
| `SUPABASE_S3_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | Proyecto → Storage → S3 connection                         |
| `R2_ACCOUNT_ID`                                    | Cloudflare → R2 (aparece en el endpoint)                   |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`        | Cloudflare → R2 → Manage API tokens                        |
| `DISCORD_WEBHOOK_URL`                              | Canal de Discord → Editar canal → Integraciones → Webhooks |

**El password de la base de prod no se usa.** El CLI de Supabase se autentica con el access token y provisiona un rol temporal en cada corrida.

## Cuándo dejar de mantener esto

Supabase Pro ($25/mes) trae backups diarios administrados y elimina toda esta maquinaria. Hoy no se justifica sin ingreso. Vale la pena reconsiderarlo cuando pase lo primero de:

- entra el primer ingreso;
- la app tiene usuarios reales dependiendo del uptime (ahí el downtime cuesta más de $25);
- los negocios pasan de ~1000.

## Si algo falla

| Síntoma                                                       | Causa probable                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Cannot find project ref`                                     | Falta `supabase link` en `/home/dvrango/vichente-backup`                                                                                                                                                                             |
| 401 / `Unauthorized` en el dump                               | `SUPABASE_ACCESS_TOKEN` vencido o revocado                                                                                                                                                                                           |
| `SignatureDoesNotMatch`                                       | Llaves de R2 o de S3 de Supabase mal copiadas                                                                                                                                                                                        |
| `403 AccessDenied` en `CreateBucket`                          | Falta `RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true`. El token de R2 es Object Read & Write sobre un bucket y no puede crear buckets; rclone verifica el destino antes de escribir. Solo aparece cuando `--backup-dir` tiene algo que mover |
| `Cannot connect to the Docker daemon`                         | Docker caído. El dump lo corre dentro de un contenedor: `sudo systemctl start docker`                                                                                                                                                |
| La primera corrida tarda muchísimo                            | Está bajando la imagen de postgres (~1 GB). Pasa una sola vez                                                                                                                                                                        |
| `psql: command not found` al verificar                        | Falta `postgresql-client-17`, o no está en el `PATH` del service                                                                                                                                                                     |
| El dump trae 0 negocios                                       | El script aborta solo y notifica: no sube un backup vacío encima de los buenos                                                                                                                                                       |
| Restauré y `businesses` quedó vacía                           | Falta el parche de `search_path` del paso 3. Los demás `COPY` sí cargan, así que engaña                                                                                                                                              |
| `function unaccent(unknown, text) does not exist`             | Lo mismo: `search_path` vacío, o falta `create extension unaccent with schema public`                                                                                                                                                |
| No llegó el heartbeat del domingo                             | El timer dejó de correr — `systemctl list-timers` y `journalctl`                                                                                                                                                                     |
| Copia a la DB local: "No hay `db/<hoy>/data.sql.gz`"          | El backup de hoy falló o todavía no corre. La copia no carga uno viejo a propósito; arreglar el backup y correr `npm run db:refresh:local`                                                                                           |
| Copia a la DB local: conteos que no cuadran o error de `COPY` | Una migración local borró o renombró una columna que prod todavía tiene. La transacción se revirtió; esperar al `db:push` o pausar la copia                                                                                          |
