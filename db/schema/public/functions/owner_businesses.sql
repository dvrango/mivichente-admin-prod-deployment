CREATE OR REPLACE FUNCTION public.owner_businesses()
  RETURNS TABLE (
    id   uuid,
    name text,
    slug text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select b.id, b.name, b.slug
  from public.businesses b
  where public.is_owner_of(b.id)
  order by b.name;
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_businesses"() TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_businesses"() IS 'Negocios de la cuenta actual si es owner. Vacío para cualquier otro rol.';

REVOKE ALL ON FUNCTION "public"."owner_businesses"() FROM PUBLIC;
