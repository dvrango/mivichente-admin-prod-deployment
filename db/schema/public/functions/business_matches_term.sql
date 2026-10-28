CREATE OR REPLACE FUNCTION public.business_matches_term (
  b    public.businesses,
  term text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."business_matches_term"(public.businesses, text) TO "anon", "authenticated", "postgres";
