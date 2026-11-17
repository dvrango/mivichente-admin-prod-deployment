CREATE OR REPLACE FUNCTION public.set_order_status (
  p_order_id uuid,
  p_status   text
)
  RETURNS TABLE (
    status  text,
    changed boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_current text;
begin
  if p_status is null or p_status not in ('accepted', 'rejected', 'preparing', 'on_the_way') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  select o.status into v_current
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if public.order_status_transition_ok(v_current, p_status) then
    update public.orders o set status = p_status where o.id = p_order_id;
    return query select p_status, true;
  else
    -- Toque repetido, de un mensaje viejo o fuera de orden: no se mueve.
    return query select v_current, false;
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_order_status"(uuid, text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."set_order_status"(uuid, text) IS 'El restaurante cambia el estado desde WhatsApp (vía el servidor): aceptado, rechazado, en preparación o en camino. Si el paso no es válido desde el estado actual (repetido, viejo, salta pasos) no cambia nada y devuelve changed = false con el estado actual. Entregado solo lo marca el cliente. Errores: invalid_status, order_not_found.';

REVOKE ALL ON FUNCTION "public"."set_order_status"(uuid, text) FROM PUBLIC;
