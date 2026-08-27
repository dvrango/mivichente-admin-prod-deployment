-- Reserva los slugs que la app mobile usa como rutas raíz de sus tabs.
--
-- El bottom nav pasó a tener un tab por modo del directorio: `/` (comida) y
-- `/negocios`. En el router de Flutter esas rutas ganan sobre el catch-all
-- `/:slug`, así que un negocio con slug `negocios` sería inalcanzable desde un
-- link — el mismo motivo por el que ya estaban reservadas las rutas del landing.
-- `comida` se reserva por simetría: hoy ese tab vive en `/`, pero si mañana se
-- le da su propio path el slug ya no estaría libre para quitárselo a un negocio.
--
-- Mantener en sync con RESERVED_SLUGS en admin/src/lib/slug.ts.
--
-- Verificado antes de aplicar: ningún negocio usa `negocios` ni `comida`.

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
    'negocios', 'comida'
  ]);
$$;
