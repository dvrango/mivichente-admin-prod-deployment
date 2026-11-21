CREATE OR REPLACE FUNCTION public.is_in_directory (
  p_business_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(
    (select b.in_directory and not b.is_demo
     from public.businesses b
     where b.id = p_business_id),
    false
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_in_directory"(uuid) TO "anon", "authenticated", "postgres", "service_role";

COMMENT ON FUNCTION "public"."is_in_directory"(uuid) IS 'True if the business appears in the public directory: in_directory and not a demo. False with null or an unknown id.';

REVOKE ALL ON FUNCTION "public"."is_in_directory"(uuid) FROM PUBLIC;
