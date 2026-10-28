CREATE OR REPLACE FUNCTION public.slug_is_reserved (
  candidate text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."slug_is_reserved"(text) TO "postgres";
