-- Reserva el slug `buscar`, que estrena la ruta de resultados de búsqueda
-- compartibles: vichente.com/buscar/<termino> (tarea u2s7le6uh).
--
-- El link que se comparte lleva dos segmentos (/buscar/zapaterias) y por eso
-- no choca con el catch-all `/:slug` de app_router.dart, que es de uno solo.
-- Lo que sí chocaría es la raíz `/buscar`: un negocio con ese slug quedaría
-- tapado por el segmento estático de Next (`src/app/buscar/`) y sería
-- inalcanzable por link directo / QR. Mismo razonamiento que
-- reserve_mobile_static_routes.
--
-- Mantener en sync con RESERVED_SLUGS en admin/src/lib/slug.ts.
--
-- Verificado antes de aplicar (prod, 2026-09-04): ningún negocio usa `buscar`.

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
    'splash', 'favoritos', 'filtro', 'omnibus-schedule',
    -- raíz de los resultados de búsqueda compartibles (landing: src/app/buscar/)
    'buscar'
  ]);
$$;
