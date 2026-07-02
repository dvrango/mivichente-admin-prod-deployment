-- Multi-categoría para negocios (many-to-many).
-- Un negocio puede pertenecer a varias categorías (ej. coro de iglesia =
-- "Iglesias" + "Grupos musicales"). El schema previo sólo permitía
-- businesses.category_id (una sola FK).
--
-- Estrategia: business_categories guarda TODAS las categorías del negocio.
-- businesses.category_id se mantiene como denormalización de la categoría
-- primaria (is_primary = true) — la card muestra un solo badge/icono y los
-- reads existentes siguen funcionando sin cambios. El filtro por categoría
-- pasa a matchear si CUALQUIERA de las categorías del negocio coincide.

create table public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (business_id, category_id)
);

-- Un solo primary por negocio.
create unique index one_primary_per_business
  on public.business_categories (business_id)
  where is_primary;

-- Filtro "match any": se consulta por category_id.
create index business_categories_category_id_idx
  on public.business_categories (category_id);

-- Backfill: la categoría actual de cada negocio se vuelve su primary.
-- 287 negocios ya tienen category_id single -> cero pérdida de datos.
insert into public.business_categories (business_id, category_id, is_primary)
select id, category_id, true
from public.businesses
where category_id is not null;

-- RLS: lectura pública, escritura sólo admin (mismo patrón que businesses/categories).
alter table public.business_categories enable row level security;

create policy "business_categories_public_read"
  on public.business_categories for select
  to public
  using (true);

create policy "business_categories_admin_all"
  on public.business_categories for all
  to authenticated
  using (true)
  with check (true);

-- RLS policies no bastan sin el grant a nivel tabla (mismo requisito que
-- business_hours -> ver migración grant_business_hours).
grant select on public.business_categories to anon, authenticated;
grant insert, update, delete on public.business_categories to authenticated;

-- search_businesses: el match por categoría ahora recorre TODAS las categorías
-- del negocio (business_categories) en vez de sólo businesses.category_id.
create or replace function public.search_businesses(search_query text)
returns setof businesses
language sql
stable
as $function$
  with q as (
    select unaccent(lower(trim(search_query))) as term
  )
  select b.*
  from public.businesses b
  cross join q
  where b.is_active = true
    and length(q.term) >= 2
    and (
      unaccent(lower(b.name)) ilike '%' || q.term || '%'
      or unaccent(lower(b.name)) % q.term
      or exists (
        select 1 from unnest(b.aliases) a
        where length(a) >= 3
          and (
            unaccent(lower(a)) ilike '%' || q.term || '%'
            or q.term ilike '%' || unaccent(lower(a)) || '%'
          )
      )
      or exists (
        select 1 from unnest(b.offerings) o
        where unaccent(lower(o)) ilike '%' || q.term || '%'
      )
      or exists (
        select 1
        from public.business_categories bc
        join public.categories c on c.id = bc.category_id
        where bc.business_id = b.id
          and (
            unaccent(lower(coalesce(c.name, ''))) ilike '%' || q.term || '%'
            or exists (
              select 1 from unnest(c.aliases) ca
              where length(ca) >= 3
                and (
                  unaccent(lower(ca)) ilike '%' || q.term || '%'
                  or q.term ilike '%' || unaccent(lower(ca)) || '%'
                )
            )
          )
      )
    )
  order by
    similarity(unaccent(lower(b.name)), q.term) desc,
    b.is_featured desc,
    b.name
  limit 50;
$function$;
