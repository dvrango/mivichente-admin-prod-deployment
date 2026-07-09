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
npm run db:reset:local    # resetear DB local desde cero (destructivo)
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
- **Mutations = Server Action** (`'use server'` + parse con Zod + `revalidatePath`). Nada de API routes salvo webhooks.
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

## Variables de entorno

Validadas en `lib/env.ts` — el build falla si falta una.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo server
```

## Base de datos

Schema en Obsidian (`02 Apps/v2-flutter/Database Schema.md`) + migraciones en `supabase/migrations/`. Tras cada migración: `npm run db:types:local`.

## Acceso

Un solo usuario admin. Login email/password via Supabase Auth. RLS en todas las tablas: admin escribe, app mobile lee como anónimo.

## Testing

Usuario de pruebas en Supabase:

```
admin@dvranlabs.com
Test1212*
```
