-- search_businesses: match difuso a nivel palabra (word_similarity).
--
-- Problema: un negocio registrado como "Sofi Barrios Nutriologa" no aparecía al
-- buscar "sofia" (nombre completo con el que la gente la busca). El match de
-- nombre usaba el operador trigram de cadena completa `%`, que compara la query
-- contra TODO el nombre:
--   similarity('sofi barrios nutriologa', 'sofia') = 0.16  -> < 0.3 -> no match
-- Como "sofia" tampoco es substring literal de "sofi barrios...", quedaba fuera.
--
-- Solución: usar el operador de similitud por palabra `<%` (word_similarity).
-- Compara la query contra la mejor palabra del nombre, no contra la cadena
-- entera, así tolera nombres largos:
--   'sofia' <% 'sofi barrios nutriologa' = true  (word_similarity 0.67 >= 0.3)
-- Es bidireccional en la práctica para variaciones cortas (sofi<->sofia) y no
-- regresa el caso de una sola palabra. Se baja el piso de longitud a >= 3 para
-- que nombres/apodos cortos también toleren typos.
--
-- Nota escala: con índice GIN trigram, `<%` puede usar el índice
-- (gin_trgm_ops); a este tamaño el seq scan sigue siendo trivial.

create or replace function public.business_matches_term(b public.businesses, term text)
returns boolean
language sql
stable
as $$
  select
    unaccent(lower(b.name)) ilike '%' || term || '%'
    or (length(term) >= 3 and term <% unaccent(lower(b.name)))
    or exists (
      select 1 from unnest(b.aliases) a
      where length(a) >= 3
        and (
          unaccent(lower(a)) ilike '%' || term || '%'
          or term ilike '%' || unaccent(lower(a)) || '%'
          or (length(term) >= 3 and term <% unaccent(lower(a)))
        )
    )
    or exists (
      select 1 from unnest(b.offerings) o
      where unaccent(lower(o)) ilike '%' || term || '%'
    )
    or exists (
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
    );
$$;

grant execute on function public.business_matches_term(public.businesses, text) to anon, authenticated;
