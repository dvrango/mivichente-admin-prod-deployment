CREATE OR REPLACE FUNCTION public.is_search_stopword (
  term text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  select term = any (array[
    'de','la','el','los','las','un','una','unos','unas',
    'y','o','en','con','para','por','del','al','a'
  ]);
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_search_stopword"(text) TO "anon", "authenticated", "postgres";
