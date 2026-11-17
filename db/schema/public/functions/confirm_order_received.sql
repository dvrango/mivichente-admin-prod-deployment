CREATE OR REPLACE FUNCTION public.confirm_order_received (
  p_token text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id     uuid;
  v_status text;
begin
  select o.id, o.status into v_id, v_status
    from public.orders o
   where o.token = p_token
     for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_status = 'delivered' then
    return v_status;
  end if;

  if v_status <> 'on_the_way' then
    raise exception 'order_not_on_the_way' using errcode = 'P0001';
  end if;

  update public.orders set status = 'delivered' where id = v_id;
  return 'delivered';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."confirm_order_received"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."confirm_order_received"(text) IS 'El cliente confirma «ya lo recibí»: en camino → entregado. Repetirlo sobre un entregado no hace nada. Errores: order_not_found, order_not_on_the_way.';

REVOKE ALL ON FUNCTION "public"."confirm_order_received"(text) FROM PUBLIC;
