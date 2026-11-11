CREATE OR REPLACE FUNCTION public.is_demo_business (
  p_business_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(
    (select b.is_demo from public.businesses b where b.id = p_business_id),
    false
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_demo_business"(uuid) TO "anon", "authenticated", "postgres", "service_role";

COMMENT ON FUNCTION "public"."is_demo_business"(uuid) IS 'True si el negocio está marcado como demo. False con null o con un id que no existe.';

REVOKE ALL ON FUNCTION "public"."is_demo_business"(uuid) FROM PUBLIC;
