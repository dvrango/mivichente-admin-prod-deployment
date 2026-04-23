# Vichente Admin — Panel Web

Arquitectura completa: `$OBSIDIAN_VAULT/Workbench/Vichente App/02 Apps/v2-admin-web/Arquitectura.md` ← leer antes de escribir código.

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
npm run db:types     # regenerar src/lib/database.types.ts tras migración
npm run db:push
```

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

## Variables de entorno

Validadas en `lib/env.ts` — el build falla si falta una.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo server
```

## Base de datos

Schema en Obsidian (`02 Apps/v2-flutter/Database Schema.md`) + migraciones en `supabase/migrations/`. Tras cada migración: `npm run db:types`.

## Acceso

Un solo usuario admin. Login email/password via Supabase Auth. RLS en todas las tablas: admin escribe, app mobile lee como anónimo.

## Testing

Usuario de pruebas en Supabase:

```
admin@dvranlabs.com
Test1212*
```
