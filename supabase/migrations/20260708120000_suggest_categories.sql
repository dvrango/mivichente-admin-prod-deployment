-- suggest_categories: sugerencias de categoría para el buscador.
--
-- Antes esta lógica vivía duplicada en el cliente Flutter
-- (CategoryRepository.matchByNameOrAlias + un count() por cada categoría que
-- matcheaba, o sea N+1). Moverla a un RPC da una sola fuente de verdad que
-- mobile y el panel admin (simulador de búsqueda) comparten, y resuelve el
-- match + conteo en una sola llamada.
--
-- Fidelidad con el cliente (matchByNameOrAlias):
--   * normaliza term = unaccent(lower(trim(query))), piso de 2 chars.
--   * matches(term): forward (el término contiene al query) SIEMPRE; inverso
--     (el query contiene al término) sólo si length(query) >= 4, para evitar
--     falsos positivos con prefijos cortos. Mismo criterio para nombre y alias.
--   * business_count = negocios ACTIVOS ligados a la categoría vía
--     business_categories (primaria O secundaria), igual que countByCategoryId.
--
-- Nota de escala: categorías es una tabla chica (decenas de filas); el seq
-- scan es trivial.

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
      -- match por nombre de categoría
      unaccent(lower(c.name)) ilike '%' || q.term || '%'
      or (length(q.term) >= 4 and q.term ilike '%' || unaccent(lower(c.name)) || '%')
      -- match por alias de categoría
      or exists (
        select 1 from unnest(c.aliases) a
        where unaccent(lower(a)) ilike '%' || q.term || '%'
           or (length(q.term) >= 4 and q.term ilike '%' || unaccent(lower(a)) || '%')
      )
    )
  group by c.id, c.name, c.icon, c.type, c.aliases
  order by c.name;
$$;

grant execute on function public.suggest_categories(text) to anon, authenticated;
