CREATE OR REPLACE FUNCTION public.search_businesses (
  search_query text
)
  RETURNS SETOF public.businesses
  LANGUAGE sql
  STABLE
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."search_businesses"(text) TO "anon", "authenticated", "postgres", "service_role";
