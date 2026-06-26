-- search_businesses: búsqueda acotada y rankeada.
--
-- Problema anterior: la función no tenía LIMIT y el match bidireccional de
-- aliases (`query ILIKE '%alias%'`) explotaba con aliases cortos (un alias de
-- 2 letras hacía que casi cualquier query lo "contuviera"), devolviendo casi
-- toda la tabla. Eso reventaba la URL del enriquecimiento de horarios en el
-- cliente y degradaba la relevancia.
--
-- Cambios:
--   * LIMIT 50 (un directorio no necesita más en un search).
--   * length(alias) >= 3 para evitar la explosión por aliases cortos.
--   * length(term) >= 2 como piso defensivo (el cliente también lo valida).
--   * pg_trgm: ranking por similitud y tolerancia a typos (operador %).
--   * ORDER BY relevancia: similitud del nombre desc, destacados, luego nombre.
--
-- Nota de escala: a este tamaño (cientos de negocios) el seq scan es trivial.
-- Si la tabla crece a miles, agregar un índice GIN trigram sobre el nombre.

create extension if not exists pg_trgm;

create or replace function public.search_businesses(search_query text)
returns setof public.businesses
language sql
stable
security invoker
as $$
  with q as (
    select unaccent(lower(trim(search_query))) as term
  )
  select b.*
  from public.businesses b
  left join public.categories c on c.id = b.category_id
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
      or unaccent(lower(coalesce(c.name, ''))) ilike '%' || q.term || '%'
      or exists (
        select 1 from unnest(c.aliases) ca
        where length(ca) >= 3
          and (
            unaccent(lower(ca)) ilike '%' || q.term || '%'
            or q.term ilike '%' || unaccent(lower(ca)) || '%'
          )
      )
    )
  order by
    similarity(unaccent(lower(b.name)), q.term) desc,
    b.is_featured desc,
    b.name
  limit 50;
$$;

grant execute on function public.search_businesses(text) to anon, authenticated;
