-- search_businesses: soporte multi-palabra.
--
-- Problema: la función matcheaba la query como un solo substring
-- (`ilike '%frase completa%'`). Una búsqueda natural como "clase de pilates"
-- no aparecía aunque el negocio tuviera el offering "pilates", porque la frase
-- entera no existe literal en ningún campo.
--
-- Solución: tokenizar la query. Un negocio matchea si:
--   * matchea la frase completa (comportamiento anterior, intacto), o
--   * matchea al menos un token significativo (palabra >= 2, sin stopwords).
-- El ranking prioriza los negocios que matchean MÁS tokens, luego similitud
-- del nombre. Así "clase de pilates" surfacea el estudio de pilates arriba sin
-- perder relevancia ni regresar el caso de una sola palabra.
--
-- La lógica de match de un término se extrae a business_matches_term() para
-- reusarla tanto en la frase como en cada token.

-- Stopwords: se ignoran como tokens (no aportan señal en un directorio).
-- Se mantienen cortas y comunes en español.
create or replace function public.is_search_stopword(term text)
returns boolean
language sql
immutable
as $$
  select term = any (array[
    'de','la','el','los','las','un','una','unos','unas',
    'y','o','en','con','para','por','del','al','a'
  ]);
$$;

-- Match de un término (frase o token) contra un negocio: nombre, aliases,
-- offerings y categorías (con sus aliases). `term` ya viene normalizado
-- (unaccent + lower). El operador trigram `%` sólo se aplica a términos de
-- >= 4 chars para no explotar con tokens muy cortos.
create or replace function public.business_matches_term(b public.businesses, term text)
returns boolean
language sql
stable
as $$
  select
    unaccent(lower(b.name)) ilike '%' || term || '%'
    or (length(term) >= 4 and unaccent(lower(b.name)) % term)
    or exists (
      select 1 from unnest(b.aliases) a
      where length(a) >= 3
        and (
          unaccent(lower(a)) ilike '%' || term || '%'
          or term ilike '%' || unaccent(lower(a)) || '%'
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

create or replace function public.search_businesses(search_query text)
returns setof public.businesses
language sql
stable
as $$
  with q as (
    select unaccent(lower(trim(search_query))) as term
  )
  select b.*
  from public.businesses b
  cross join q
  left join lateral (
    -- cuántos tokens significativos de la query matchea este negocio
    select count(*) as hits
    from regexp_split_to_table(q.term, '\s+') as tok
    where length(tok) >= 2
      and not public.is_search_stopword(tok)
      and public.business_matches_term(b, tok)
  ) tk on true
  where b.is_active = true
    and length(q.term) >= 2
    and (
      public.business_matches_term(b, q.term)
      or tk.hits > 0
    )
  order by
    tk.hits desc,
    similarity(unaccent(lower(b.name)), q.term) desc,
    b.is_featured desc,
    b.name
  limit 50;
$$;

grant execute on function public.is_search_stopword(text) to anon, authenticated;
grant execute on function public.business_matches_term(public.businesses, text) to anon, authenticated;
grant execute on function public.search_businesses(text) to anon, authenticated;
