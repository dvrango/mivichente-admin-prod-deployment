CREATE OR REPLACE FUNCTION public.guard_business_is_demo_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if (
    (tg_op = 'INSERT' and new.is_demo)
    or (tg_op = 'UPDATE' and old.is_demo is distinct from new.is_demo)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.is_demo'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."guard_business_is_demo_admin"() TO "postgres";

COMMENT ON FUNCTION "public"."guard_business_is_demo_admin"() IS 'Impide que cualquier identidad de aplicación distinta de admin marque o desmarque un negocio demo. Solo exceptúa postgres para operación de infraestructura.';

REVOKE ALL ON FUNCTION "public"."guard_business_is_demo_admin"() FROM PUBLIC;
