CREATE OR REPLACE FUNCTION public.slugify (
  txt text
)
  RETURNS text
  LANGUAGE sql
  STABLE
  AS $function$
  select trim(
    both '-' from
    regexp_replace(
      regexp_replace(lower(unaccent(coalesce(txt, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."slugify"(text) TO "postgres";
