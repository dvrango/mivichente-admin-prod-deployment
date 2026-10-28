CREATE OR REPLACE FUNCTION public.user_municipio()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select municipio from public.profiles
  where id = auth.uid() and role in ('admin', 'reviewer');
$function$;

GRANT EXECUTE ON FUNCTION "public"."user_municipio"() TO "postgres";

COMMENT ON FUNCTION "public"."user_municipio"() IS 'Municipio de la cuenta actual, solo si tiene rol de staff. Null para `pending` y para el admin (que no está atado a un municipio).';
