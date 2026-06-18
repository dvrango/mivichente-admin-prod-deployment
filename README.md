# Vichente Admin — Panel Web

Panel de administración para Vichente App 2.0. Conectado a Supabase (compartido con la app mobile).

Arquitectura completa: `$OBSIDIAN_VAULT/Workbench/Vichente App/02 Apps/v2-admin-web/Arquitectura.md`

---

## Stack

- Next.js 16 (App Router, `src/` layout)
- TypeScript strict
- shadcn/ui + Tailwind
- Supabase (Postgres + Auth + Storage) con `@supabase/ssr`
- Zod para validación
- `@t3-oss/env-nextjs` para env vars
- Vitest para testing

## Setup

```bash
cp .env.example .env.local   # rellenar con credenciales reales
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm run lint
npm run format      # prettier --write .
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run db:migrate:local  # aplicar migrations pendientes en local (minipc)
npm run db:push           # aplicar migrations pendientes en producción
npm run db:types:local    # regenerar database.types.ts desde DB local
npm run db:types:prod     # regenerar tipos desde Supabase remoto
npm run db:reset:local    # resetear DB local desde cero (destructivo)
```

## Estructura (feature-based)

```
src/
├── app/                # routing, layouts, páginas
├── features/           # dominios: businesses/, categories/, auth/
│   └── <dominio>/
│       ├── schema.ts   # Zod
│       ├── queries.ts  # reads (Server Components)
│       ├── actions.ts  # Server Actions (writes + revalidate)
│       ├── types.ts
│       └── components/
├── components/
│   ├── ui/             # shadcn (no modificar)
│   └── shared/
└── lib/
    ├── env.ts          # validación de process.env
    ├── database.types.ts  # GENERADO
    └── supabase/       # client / server / admin / session
proxy.ts                # auth guard (reemplaza middleware.ts en Next 16)
supabase/migrations/    # SQL versionado
```

## Convenciones

- **`app/` solo orquesta** — los dominios viven en `features/`.
- **Server Components por defecto.** `'use client'` solo para interactividad.
- **Mutations vía Server Actions** con Zod + `revalidatePath`.
- **Imports con `@/`** — nada de `../../../`.
- **Tipos de DB generados** — correr `npm run db:types:local` tras cada migración.

## Base de datos

Schema y migraciones en `supabase/migrations/`. Fuente de verdad documentada en Obsidian (`02 Apps/v2-flutter/Database Schema.md`).
