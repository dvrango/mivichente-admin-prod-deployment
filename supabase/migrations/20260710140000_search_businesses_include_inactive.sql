-- Bug: search_businesses() forzaba `where b.is_active = true`, así que el
-- panel admin nunca podía ver negocios inactivos al buscar (aunque el filtro
-- de status en la UI dijera "todos" o "inactivos"). RLS ya restringe lo que
-- ve cada rol (anon: solo activos vía businesses_public_read, authenticated:
-- todos vía businesses_select), así que el filtro extra en la función era
-- redundante para app mobile y roto para admin. Se quita.

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
  where length(q.term) >= 2
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

grant execute on function public.search_businesses(text) to anon, authenticated;
