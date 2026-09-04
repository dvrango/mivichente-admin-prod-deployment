-- Reserva las rutas estáticas top-level de un solo segmento que faltaban de
-- mobile/lib/core/router/app_router.dart. Cada una es hermana de la ruta
-- catch-all `/:slug` (línea 122 de app_router.dart) y le gana en el matching
-- de GoRouter, así que un negocio con ese slug quedaría inalcanzable por link
-- directo / QR.
--
-- Encontrado en code review 2026-09-01 (tarea hjhmv9lj6): la migration
-- reserve_tab_slugs sólo cubrió los tabs (`negocios`, `comida`) y dejó fuera
-- el resto de rutas estáticas de un segmento:
--   /splash (L18), /favoritos (L48), /filtro (L63), /omnibus-schedule (L95)
--
-- Rutas con :param (/category/:id, /business/:id, /negocio/:id) no colisionan
-- con /:slug de un segmento y no se reservan.
--
-- Mantener en sync con RESERVED_SLUGS en admin/src/lib/slug.ts.

create or replace function public.slug_is_reserved(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate = any (array[
    -- rutas / infra del sitio
    'legal', 'support', 'negocio', 'api', 'admin', 'www', 'app',
    'about', 'privacy', 'terms', '_next', 'static', 'public', 'assets',
    'favicon', 'robots', 'sitemap',
    -- reservados de producto
    'index', 'home', 'contact', 'help', 'login', 'signup', 'register',
    'registrar-negocio', 'business', 'search', 'explorar', 'vichente',
    -- rutas raíz de los tabs de la app mobile
    'negocios', 'comida',
    -- rutas estáticas top-level de un solo segmento en app_router.dart
    'splash', 'favoritos', 'filtro', 'omnibus-schedule'
  ]);
$$;
