-- Fix: el match de suggest_categories usaba ILIKE con el término interpolado,
-- así que `%` y `_` del query actuaban como comodines (ej. 'a_c' matcheaba
-- 'abc'/'axc' → falsos positivos). El cliente Flutter (matchByNameOrAlias) usa
-- String.contains, que es substring LITERAL sin comodines.
--
-- Cambio: ILIKE → strpos sobre texto ya normalizado (unaccent+lower). strpos
-- busca substring literal, sin metacaracteres, y como ambos lados ya están en
-- minúsculas no necesitamos ILIKE. Queda fiel al cliente y sin inyección de
-- comodines. Se agrega guard de alias no vacío (el cliente descarta term vacío).

create or replace function public.suggest_categories(search_query text)
returns table (
  id             uuid,
  name           text,
  icon           text,
  type           text,
  aliases        text[],
  business_count bigint
)
language sql
stable
security invoker
as $$
  with q as (
    select unaccent(lower(trim(search_query))) as term
  )
  select
    c.id,
    c.name,
    c.icon,
    c.type,
    c.aliases,
    count(distinct bc.business_id) filter (where b.is_active) as business_count
  from public.categories c
  cross join q
  left join public.business_categories bc on bc.category_id = c.id
  left join public.businesses b on b.id = bc.business_id
  where length(q.term) >= 2
    and (
      -- match por nombre: forward (el nombre contiene al término) siempre;
      -- inverso (el término contiene al nombre) sólo si length(term) >= 4.
      strpos(unaccent(lower(c.name)), q.term) > 0
      or (length(q.term) >= 4 and strpos(q.term, unaccent(lower(c.name))) > 0)
      -- match por alias, mismo criterio; se ignoran aliases vacíos.
      or exists (
        select 1 from unnest(c.aliases) a
        where unaccent(lower(a)) <> ''
          and (
            strpos(unaccent(lower(a)), q.term) > 0
            or (length(q.term) >= 4 and strpos(q.term, unaccent(lower(a))) > 0)
          )
      )
    )
  group by c.id, c.name, c.icon, c.type, c.aliases
  order by c.name;
$$;

grant execute on function public.suggest_categories(text) to anon, authenticated;
