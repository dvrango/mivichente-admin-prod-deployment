# Vichente Admin — Panel Web

Panel de administración para gestionar el directorio de Vichente App. Permite crear, editar y activar/desactivar negocios y categorías. Solo accesible para el admin.

Docs del proyecto: `Workbench/Vichente App/vichente-eats/`

- Qué construir: `01 Product/PRD Vichente App 2.0.md`
- Arquitectura: `007 Tech/Arquitectura Vichente App 2.0.md`
- Plan de ejecución: `08 Execution/Plan de Implementacion MVP 2.0.md`

---

## Stack

- **Next.js** (App Router)
- **UI** — shadcn/ui
- **Backend** — Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **Deploy** — Vercel

## Comandos

```bash
npm run dev       # desarrollo local
npm run build     # build de producción
npm run lint      # linting
npm run format    # prettier --write .
```

## Estructura

Este proyecto usa el layout `src/` de Next.js (default en Next 16). Migraciones SQL y config de Supabase CLI en `supabase/`.

```
src/
├── app/
│   ├── page.tsx             # redirect a /businesses
│   ├── (auth)/
│   │   └── login/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx       # layout con sidebar, verifica auth
│       ├── businesses/
│       │   ├── page.tsx     # listado con búsqueda y filtros
│       │   ├── new/page.tsx # crear negocio
│       │   └── [id]/page.tsx # editar negocio
│       └── categories/
│           ├── page.tsx     # listado
│           └── new/page.tsx # crear categoría
├── components/
│   └── ui/                  # componentes shadcn (no modificar)
└── lib/
    ├── utils.ts             # cn() helper (shadcn)
    └── supabase/
        ├── client.ts        # cliente browser
        ├── server.ts        # cliente server (cookies)
        └── proxy.ts         # helper de sesión para proxy.ts

proxy.ts                     # auth guard global (Next 16 reemplazo de middleware)
supabase/
├── config.toml              # Supabase CLI config
└── migrations/              # SQL de migraciones
```

## Convenciones

- **Server Components por defecto** — solo usar `'use client'` cuando sea necesario (formularios, interactividad)
- **shadcn/ui para todo** — no instalar otras librerías de UI
- **Supabase server client en Server Components** — nunca exponer service role key al cliente
- **`proxy.ts` protege el dashboard** — si no hay sesión, redirect a `/login`. En Next 16, `middleware.ts` fue renombrado a `proxy.ts` (misma semántica)
- **Responsive obligatorio** — el panel debe funcionar en mobile, tablet y desktop
  - Sidebar: drawer colapsable en mobile (`Sheet` de shadcn), fijo en desktop
  - Tablas: scroll horizontal en mobile o vista tipo card en pantallas chicas
  - Formularios: una columna en mobile, dos columnas en tablet+
  - Breakpoints Tailwind: `sm` (640px), `md` (768px), `lg` (1024px)

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo server-side, nunca al cliente
```

## Base de datos

Schema completo en `007 Tech/Database Schema.md` (fuente de verdad).

Fotos de negocios van a Supabase Storage, bucket `business-photos`. La columna `photo_url` guarda la URL pública.

## Acceso

Un solo usuario admin. Login con email/password via Supabase Auth. RLS configurado para que solo el admin pueda escribir en las tablas.
