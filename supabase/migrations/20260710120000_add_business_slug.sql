-- Slugs root-level para URLs de negocio estilo Instagram: vichente.com/el-tunner
-- en vez de vichente.com/negocio/{uuid}. Más corto = más compartible/dictable
-- (canal de WhatsApp del pueblo). El slug reemplaza al UUID en las URLs públicas.
--
-- SIN retrocompat: nadie usa la app aún, no hay links viejos que romper.
--
-- Este migration:
--   1. slugify() → normaliza texto a slug (lowercase, sin acentos, guiones).
--   2. slug_is_reserved() → blocklist de palabras que no puede tomar un negocio
--      (como IG no deja instagram.com/about). Cubre rutas estáticas del landing.
--   3. unique_business_slug() → resuelve colisiones con sufijo -2, -3, ...
--   4. Trigger que autogenera el slug al insertar/actualizar si viene vacío,
--      y rechaza slugs reservados asignados a mano desde el admin.
--   5. Columna businesses.slug (única) + backfill de negocios existentes.

create extension if not exists unaccent;

-- Normaliza texto a slug. STABLE (no IMMUTABLE) porque unaccent() es STABLE;
-- suficiente para triggers y backfill (no se usa en columnas generadas).
create or replace function public.slugify(txt text)
returns text
language sql
stable
as $$
  select trim(
    both '-' from
    regexp_replace(
      regexp_replace(lower(unaccent(coalesce(txt, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- Blocklist de slugs reservados. Incluye rutas estáticas del landing (que en
-- Next.js ganan sobre la ruta dinámica /[slug], así que técnicamente no se
-- "rompen", pero un negocio con ese slug sería inalcanzable) + prefijos de
-- infraestructura + términos que queremos reservar a futuro.
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
    'registrar-negocio', 'business', 'search', 'explorar', 'vichente'
  ]);
$$;

-- Devuelve un slug único a partir de `base`, evitando colisiones con otras
-- filas y con la blocklist. Si `base` ya está libre lo devuelve tal cual; si no,
-- prueba base-2, base-3, ... `exclude_id` permite reusar el propio slug al
-- actualizar un negocio existente.
create or replace function public.unique_business_slug(base text, exclude_id uuid default null)
returns text
language plpgsql
stable
as $$
declare
  root text := nullif(public.slugify(base), '');
  candidate text;
  n int := 1;
begin
  if root is null then
    root := 'negocio';
  end if;
  candidate := root;
  loop
    -- reservado o ya tomado por otra fila → prueba el siguiente sufijo
    if public.slug_is_reserved(candidate)
       or exists (
         select 1 from public.businesses b
         where b.slug = candidate
           and (exclude_id is null or b.id <> exclude_id)
       )
    then
      n := n + 1;
      candidate := root || '-' || n;
    else
      return candidate;
    end if;
  end loop;
end;
$$;

alter table public.businesses
  add column if not exists slug text;

-- Trigger: garantiza que toda fila tenga un slug válido y único.
--   * slug vacío (scraping, auto-registro) → autogenera desde el nombre.
--   * slug asignado a mano (admin) → si está reservado o colisiona, lo resuelve
--     con sufijo en vez de fallar (el admin ya valida antes para dar buen
--     mensaje; esto es la red de seguridad de la DB).
create or replace function public.businesses_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.unique_business_slug(new.name, new.id);
  else
    new.slug := public.slugify(new.slug);
    -- Si tras normalizar quedó vacío, reservado o duplicado, recalcula.
    if new.slug = ''
       or public.slug_is_reserved(new.slug)
       or exists (
         select 1 from public.businesses b
         where b.slug = new.slug and b.id <> new.id
       )
    then
      new.slug := public.unique_business_slug(coalesce(nullif(new.slug, ''), new.name), new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_set_slug_trigger on public.businesses;
create trigger businesses_set_slug_trigger
  before insert or update of slug, name on public.businesses
  for each row execute function public.businesses_set_slug();

-- Backfill de negocios existentes. Particiona por slug base y numera los
-- duplicados (rn=1 se queda con el slug limpio; rn>=2 obtiene -2, -3, ...).
with base as (
  select id, coalesce(nullif(public.slugify(name), ''), 'negocio') as root
  from public.businesses
  where slug is null
),
ranked as (
  select id, root,
         row_number() over (partition by root order by id) as rn
  from base
)
update public.businesses b
set slug = case when r.rn = 1 then r.root else r.root || '-' || r.rn end
from ranked r
where b.id = r.id;

-- Corrige los pocos casos donde el slug backfilleado cayó en la blocklist
-- (p.ej. un negocio llamado literalmente "App"): les añade sufijo único.
update public.businesses
set slug = public.unique_business_slug(slug, id)
where public.slug_is_reserved(slug);

alter table public.businesses
  alter column slug set not null;

-- Default '' para que los INSERT puedan omitir slug (el trigger lo genera). Sin
-- esto, los tipos generados marcan slug como requerido en Insert.
alter table public.businesses
  alter column slug set default '';

create unique index if not exists businesses_slug_key on public.businesses (slug);
