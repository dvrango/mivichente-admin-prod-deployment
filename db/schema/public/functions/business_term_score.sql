CREATE OR REPLACE FUNCTION public.business_term_score (
  b    public.businesses,
  term text
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."business_term_score"(public.businesses, text) TO "anon", "authenticated", "postgres";
