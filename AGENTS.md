<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Vichente Admin — Panel Web

Arquitectura completa: `$OBSIDIAN_VAULT/Workbench/Vichente App/02 Apps/v2-admin-web/Arquitectura.md` ← leer antes de escribir código.

## Contexto y target users

Panel administrativo privado de un negocio propio operando en un municipio de Durango, México.

**Target users:**

- Propietario del negocio (usuario principal, perfil no técnico).
- Personal de confianza autorizado para gestionar contenido (negocios, categorías).

**Localización:** español MX, formato de datos, teléfonos y direcciones mexicanos.

## Stack

Next.js 16 (App Router, `src/`) · TypeScript strict · shadcn/ui + Tailwind · Supabase (`@supabase/ssr`) · Zod · `@t3-oss/env-nextjs` · Vitest.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run typecheck
npm run test
npm run db:migrate:local  # aplicar migrations pendientes en local (minipc)
npm run db:push           # aplicar migrations pendientes en producción
npm run db:types:local    # regenerar database.types.ts desde DB local
npm run db:types:prod     # regenerar tipos desde Supabase remoto
npm run db:replay:check   # comprobar que las migrations reconstruyen la DB desde cero (minipc, no toca la DB local)
npm run db:rls:check      # verificar las policies RLS contra la DB local (impersona y hace ROLLBACK)
npm run db:schema:snapshot # regenerar db/schema/ desde la DB local (sin Docker)
npm run db:schema:check   # fallar si db/schema/ no coincide con la DB local
npm run db:local:check    # fallar si la DB local tiene una migración de otra rama (y decir de qué tarea)
node scripts/stamp-card-check.mjs # sellos demo/reales, idempotencia y carreras con conexiones distintas; solo local, limpia sus fixtures
node scripts/order-check.mjs      # pedido con estados como anon y service_role: precios, rechazos, transiciones y carrera; solo local, limpia sus fixtures
node scripts/in-directory-check.mjs # negocio fuera del directorio: se oculta a anon, solo admin cambia la marca, Durango nace fuera y las métricas de la región no lo cuentan; solo local, todo en rollback
node scripts/order-notify-check.mjs # aviso del pedido por WhatsApp: levanta next dev con un Meta falso y prueba las dos rutas de punta a punta (firma, toques repetidos, número ajeno, envío rechazado); solo local, limpia sus fixtures
node scripts/order-retention-check.mjs # borrado de los datos del cliente a los 90 días del último cambio de estado, en cada estado y a 89/91 días, más quién puede correrlo y el horario de pg_cron; solo local, todo en rollback
```

> **REGLA DE BASE DE DATOS (no la rompas):** el asistente **solo toca la DB
> local** (`db:migrate:local`, psql a `100.96.221.80`). **Producción la aplica
> el usuario**, nunca el asistente. Prohibido usar `mcp__supabase__apply_migration`,
> `db:push`, o cualquier write contra la DB cloud/linked. Flujo: escribir la
> migración → aplicar a local → validar → avisar al usuario para que él haga
> `npm run db:push`. `mcp__supabase__execute_sql` solo para lecturas.

## Estructura (feature-based)

```
src/
├── app/                  # SOLO routing, layouts, páginas — sin lógica de negocio
├── features/             # DOMINIOS (código real)
│   ├── businesses/  { schema, queries, actions, types, components/ }
│   ├── categories/  { schema, queries, actions, types, components/ }
│   └── auth/        { schema, queries, actions, components/ }
├── components/
│   ├── ui/               # shadcn (no modificar)
│   └── shared/
└── lib/
    ├── env.ts            # validación Zod de process.env
    ├── database.types.ts # GENERADO — no editar
    └── supabase/         # client / server / admin / session
proxy.ts                  # auth guard (Next 16 reemplazo de middleware.ts)
supabase/migrations/
```

## Reglas (críticas)

- **`app/` solo orquesta** — no SQL ni lógica inline; importar desde `features/*/queries.ts`.
- **Server Components por defecto.** `'use client'` solo para forms/interactividad.
- **Mutations = Server Action** (`'use server'` + parse con Zod + `revalidatePath`). Nada de API routes salvo webhooks y lo que llama la app sin sesión: hoy solo `src/app/api/` del aviso del pedido por WhatsApp (`features/order-notifications/`). Una ruta así no tiene login detrás: valida su propio secreto (la firma de Meta, el token del pedido).
- **Un Zod schema por mutation** en `features/*/schema.ts` (fuente de verdad).
- **Tipos de DB** se generan (`database.types.ts`). Nunca tipar tablas a mano.
- **`server-only`** en `queries.ts` y `lib/supabase/admin.ts`.
- **`SUPABASE_SERVICE_ROLE_KEY`** solo vía `lib/supabase/admin.ts`. Nunca `NEXT_PUBLIC_*`.
- **Imports con `@/`** — sin `../../../`.
- **`loading.tsx` + `error.tsx`** en cada segmento de dashboard.
- **Responsive obligatorio.**
- Todos los filtros deben ir por URL
- Listas con paginacion o infinite scroll, no cargar todo de golpe
- Inputs con validacion que es probable que se repitan en forms tienen que ser reusables
- **Las imágenes se generan en canvas, del lado del cliente.** Vercel no tiene Chrome ni binarios del sistema, así que un render en servidor implicaría puppeteer o un servicio aparte. El ejemplo vivo es `src/features/material-grafico/`. Tres trampas del canvas que no dan error:
  - Hay que esperar la fuente (`FontFace` + `document.fonts`) antes de dibujar. Si no, la pieza sale con la letra del sistema.
  - El QR se pinta módulo a módulo, con los módulos de `QRCode.create` y un tamaño de módulo entero (`Math.floor`). Con fracciones, el código sale rayado al imprimirse.
  - Un QR se verifica decodificando el PNG (por ejemplo con `jsqr` + `pngjs`), no comparándolo contra el texto que lo generó.
- **El `Button` de `components/ui` no soporta `asChild`.** Para un link con aspecto de botón, se pone `buttonVariants()` en el `className` del `<Link>`.

## Variables de entorno

Validadas en `lib/env.ts` — el build falla si falta una.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo server

# Opcionales: aviso del pedido por WhatsApp. Sin ellas solo las rutas del
# aviso responden 503; el resto del panel funciona y compila.
WHATSAPP_ACCESS_TOKEN=       # token de usuario de sistema de Meta
WHATSAPP_PHONE_NUMBER_ID=    # id del número 618 en la Cloud API
WHATSAPP_APP_SECRET=         # firma de los webhooks
WHATSAPP_VERIFY_TOKEN=       # el que se pega en Meta al registrar el webhook
```

## Base de datos

Migraciones en `supabase/migrations/`: son la fuente de verdad y se escriben a mano. Tras aplicar una a local: `npm run db:types:local` y `npm run db:schema:snapshot`, y se commitean los tipos y `db/schema/` junto con la migración. `npm run db:schema:check` falla si el snapshot quedó viejo.

`db/schema/` es un snapshot generado de la DB local: `public` (un archivo por tabla y función, con policies y grants), más `storage/tables/objects.sql` con **las policies de los buckets**, `auth/tables/users.sql` con el trigger `on_auth_user_created`, las extensiones en `_cluster/extensions/` y los trabajos de `pg_cron` en `_cluster/misc.sql`. Es solo para leer: no se edita a mano y no va en `supabase/schemas/` ni en ninguna ruta de `[db.migrations] schema_paths`, porque el flujo declarativo del CLI lo tomaría como fuente. Lo genera `supabase db schema declarative generate --experimental`, con la versión del CLI fijada en `scripts/db-schema-snapshot.sh` (`CLI_VERSION`); en la Mac conviene `brew pin supabase` para que un `brew upgrade` no la mueva. Al subir el CLI, se sube esa línea y se regenera el snapshot en el mismo commit.

**La DB local es una sola para todas las ramas, así que las tareas con migración van una a la vez.** Si otra rama ya aplicó su migración a local, `db:schema:snapshot` la mete en el commit de esta rama, `db:schema:check` falla en ramas que no tocaron la DB y `db:rls:check` mide policies ajenas. Lo hace cumplir `npm run db:local:check`: compara `supabase_migrations.schema_migrations` contra `supabase/migrations/` de `origin/master` más la rama actual, falla si local tiene una migración que no es de ninguno de los dos y dice en qué rama vive (y de qué tarea, por el nombre `{taskId}-admin`). `db:migrate:local`, `db:schema:snapshot`, `db:schema:check` y `db:rls:check` lo corren antes y se detienen si falla. Si falla, no apliques tu migración: espera a que esa tarea se mergee a `master`. Si la tarea se abandonó, revertir su migración en local lo decide el usuario. También falla si la rama está atrás de `origin/master` y local ya tiene una migración que la rama no trae: rebasea antes de migrar o de regenerar el snapshot. Que a local le falte una migración de `origin/master` que la rama sí trae solo avisa: corre `db:migrate:local` (si ya aplicaste una propia con timestamp posterior, el CLI pide `--include-all`). La URL solo acepta hosts locales, para que `db:migrate:local` no pueda apuntar a prod.

El check no ve cambios hechos a mano sin migración: antes de commitear, revisar que `git diff db/schema` solo traiga lo de la migración de la rama. `npm run db:replay:check` muestra lo que local tiene fuera de las migraciones, aunque solo de `public`: las policies de `storage` no las compara.

`db:push` y `db:types:prod` nombran el proyecto de producción (`fmvzwonzcnkrhjdeonaz`) en `package.json` en vez de leer la liga de `supabase link`. Esa liga vive en `supabase/.temp/`, que git ignora, así que las carpetas del mikitasks-runner y cualquier clon nuevo nacen sin ella y el CLI fallaba con «Cannot find project ref». La autenticación sale del token global del CLI (`supabase login`), no de la carpeta. El identificador no es secreto: va en la URL pública del proyecto.

La URL de la DB local sale de `LOCAL_DATABASE_URL` (fuente única en `scripts/db-local-url.mjs`); sin la variable es la del minipc. La usan `db:migrate:local`, `db:schema:snapshot`/`check`, `db:rls:check` y `db:local:check`. `db:types:local` no: pasa por postgres-meta vía Kong, que siempre lee la base `postgres`.

El porqué de cada tabla y función (decisiones, trampas, historia de RLS) vive en Obsidian: `02 Apps/v2-admin-web/Database Schema.md`. Ahí no se pegan columnas ni cuerpos de funciones.

## Deploy

**Un push a `master` es un deploy a producción.** `.github/workflows/deploy-prod.yml` empuja `master` al repo espejo `dvrango/mivichente-admin-prod-deployment`, que es el que Vercel tiene conectado (Vercel Hobby no despliega desde repos privados de organización). El asistente no empuja `master`: la rama de la tarea llega a la base por PR, y el merge lo hace el usuario.

Si lo que falta desplegar trae migraciones nuevas en `supabase/migrations/`, el workflow no despliega y termina en rojo: el código no puede llegar a prod antes que su migración. El usuario corre `npm run db:push` y dispara el workflow a mano desde Actions, marcando la casilla del `db:push`. La detección vive en `scripts/deploy/check-migrations.sh` y compara contra lo que tiene el espejo, no contra el último push.

Detalle, credencial y salida de emergencia: `02 Apps/v2-admin-web/Produccion.md` en Obsidian.

## Acceso

Un solo usuario admin. Login email/password via Supabase Auth. RLS en todas las tablas: admin escribe, app mobile lee como anónimo.

## Testing

Usuario de pruebas en Supabase:

```
admin@dvranlabs.com
Test1212*
```
