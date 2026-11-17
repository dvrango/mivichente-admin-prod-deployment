CREATE OR REPLACE FUNCTION public.guard_business_order_tracking_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if (
    (tg_op = 'INSERT' and new.order_tracking)
    or (tg_op = 'UPDATE' and old.order_tracking is distinct from new.order_tracking)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.order_tracking'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."guard_business_order_tracking_admin"() TO "postgres";

COMMENT ON FUNCTION "public"."guard_business_order_tracking_admin"() IS 'Impide que cualquier identidad de aplicación distinta de admin encienda o apague el pedido con estados. Solo exceptúa postgres para operación de infraestructura.';

REVOKE ALL ON FUNCTION "public"."guard_business_order_tracking_admin"() FROM PUBLIC;
