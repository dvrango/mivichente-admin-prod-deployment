CREATE OR REPLACE FUNCTION public.guard_business_accepts_orders_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if (
    (tg_op = 'INSERT' and new.accepts_orders)
    or (tg_op = 'UPDATE' and old.accepts_orders is distinct from new.accepts_orders)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.accepts_orders'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."guard_business_accepts_orders_admin"() TO "postgres";

COMMENT ON FUNCTION "public"."guard_business_accepts_orders_admin"() IS 'Impide que cualquier identidad de aplicación distinta de admin active o desactive pedidos. Solo exceptúa postgres para operación de infraestructura.';

REVOKE ALL ON FUNCTION "public"."guard_business_accepts_orders_admin"() FROM PUBLIC;
