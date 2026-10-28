CREATE OR REPLACE FUNCTION public.is_staff()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'reviewer')
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."is_staff"() IS 'True si la cuenta actual tiene rol asignado (admin o reviewer). False para `pending`, o sea para cualquiera que se haya registrado y todavía no habilite un admin. Es el gate de LECTURA del panel; la escritura la decide can_edit_business().';
