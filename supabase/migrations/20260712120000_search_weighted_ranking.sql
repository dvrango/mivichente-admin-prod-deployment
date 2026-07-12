-- Reemplaza el ranking de búsqueda: de boolean plano (cualquier match cuenta
-- igual) a score ponderado por tipo de campo. Bug real: "barbacoa x kilo"
-- rankeaba taquerías que sólo matchean por categoría ("Comida Mexicana")
-- por encima del negocio que sí ofrece "barbacoa x kilo", porque
-- business_matches_term devolvía un boolean sin distinguir de dónde vino
-- el match.
--
-- Prioridad de señal (de mayor a menor intención del usuario):
--   offerings (3) > nombre/alias (2, con boost por similarity si es fuzzy)
--   > categoría (1)
-- is_featured queda SOLO como desempate final, nunca puede superar a un
-- resultado más relevante (decisión de producto: no reintroducir el sesgo
-- que ya rompió la búsqueda una vez).

create or replace function public.business_term_score(b public.businesses, term text)
returns numeric
language sql
stable
as $$
  select coalesce((
    select max(s) from (values
      -- offerings: match de producto/servicio específico, señal más fuerte
      (case when exists (
        select 1 from unnest(b.offerings) o
        where unaccent(lower(o)) ilike '%' || term || '%'
      ) then 3.0 end),
      -- nombre: substring exacto pesa 2; fuzzy (word_similarity) escala
      -- entre 1 y 2 según qué tan cerca esté, para no empatar con un
      -- match débil
      (case
        when unaccent(lower(b.name)) ilike '%' || term || '%' then 2.0
        when length(term) >= 3 and term <% unaccent(lower(b.name))
          then 1.0 + similarity(unaccent(lower(b.name)), term)
      end),
      -- alias: mismo nivel que nombre (un alias ES un nombre alterno)
      (case when exists (
        select 1 from unnest(b.aliases) a
        where length(a) >= 3
          and (
            unaccent(lower(a)) ilike '%' || term || '%'
            or term ilike '%' || unaccent(lower(a)) || '%'
            or (length(term) >= 3 and term <% unaccent(lower(a)))
          )
      ) then 2.0 end),
      -- categoría: señal más débil, casi cualquier negocio del rubro matchea
      (case when exists (
        select 1
        from public.business_categories bc
        join public.categories c on c.id = bc.category_id
        where bc.business_id = b.id
          and (
            unaccent(lower(coalesce(c.name, ''))) ilike '%' || term || '%'
            or exists (
              select 1 from unnest(c.aliases) ca
              where length(ca) >= 3
                and (
                  unaccent(lower(ca)) ilike '%' || term || '%'
                  or term ilike '%' || unaccent(lower(ca)) || '%'
                )
            )
          )
      ) then 1.0 end)
    ) as t(s)
  ), 0);
$$;

grant execute on function public.business_term_score(public.businesses, text) to anon, authenticated;

-- business_matches_term se mantiene (usado por BusinessCard client-side vía
-- _matchedOfferings) pero ya no decide el orden de search_businesses.

create or replace function public.search_businesses(search_query text)
returns setof public.businesses
language sql
stable
as $$
  with q as (
    select unaccent(lower(trim(search_query))) as term
  ),
  tokens as (
    select distinct tok
    from q, regexp_split_to_table(q.term, '\s+') as tok
    where length(tok) >= 2
      and not public.is_search_stopword(tok)
  ),
  -- si el query es puro stopword/tokens cortos ("de la"), no dejamos la
  -- búsqueda sin señal: cae al término completo como único token
  effective_tokens as (
    select tok from tokens
    union all
    select term as tok from q where not exists (select 1 from tokens)
  ),
  scored as (
    select b.id, sum(public.business_term_score(b, t.tok)) as total_score
    from public.businesses b
    cross join effective_tokens t
    group by b.id
  )
  select b.*
  from public.businesses b
  join scored s on s.id = b.id
  cross join q
  where length(q.term) >= 2
    and s.total_score > 0
  order by
    s.total_score desc,
    b.is_featured desc,
    b.name
  limit 50;
$$;

grant execute on function public.search_businesses(text) to anon, authenticated;
