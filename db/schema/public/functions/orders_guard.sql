CREATE OR REPLACE FUNCTION public.orders_guard()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending'
       or new.notify_status <> 'pending'
       or new.notify_error is not null
       or new.notify_updated_at is not null
       or num_nonnulls(new.accepted_at, new.rejected_at, new.preparing_at,
                       new.on_the_way_at, new.delivered_at) > 0 then
      raise exception 'order_must_start_pending' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Lo que el cliente pidió no cambia después de crearse.
  if (new.id, new.token, new.business_id, new.mode, new.items, new.subtotal_cents,
      new.delivery_fee_cents, new.total_cents, new.created_at)
     is distinct from
     (old.id, old.token, old.business_id, old.mode, old.items, old.subtotal_cents,
      old.delivery_fee_cents, old.total_cents, old.created_at) then
    raise exception 'order_is_immutable' using errcode = '42501';
  end if;

  -- Los datos del cliente solo se pueden borrar (retención), nunca reescribir.
  if (new.customer_name is distinct from old.customer_name and new.customer_name is not null)
     or (new.customer_phone is distinct from old.customer_phone and new.customer_phone is not null)
     or (new.delivery_lat is distinct from old.delivery_lat and new.delivery_lat is not null)
     or (new.delivery_lng is distinct from old.delivery_lng and new.delivery_lng is not null)
     or (new.delivery_directions is distinct from old.delivery_directions and new.delivery_directions is not null)
     or (new.delivery_references is distinct from old.delivery_references and new.delivery_references is not null)
     or (new.pays_with is distinct from old.pays_with and new.pays_with is not null) then
    raise exception 'order_customer_data_is_immutable' using errcode = '42501';
  end if;

  -- Las horas de estado solo las escribe este trigger.
  if (new.accepted_at, new.rejected_at, new.preparing_at, new.on_the_way_at, new.delivered_at)
     is distinct from
     (old.accepted_at, old.rejected_at, old.preparing_at, old.on_the_way_at, old.delivered_at) then
    raise exception 'order_status_times_are_managed' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not public.order_status_transition_ok(old.status, new.status) then
      raise exception 'invalid_order_transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    -- Entregado lo marca solo el cliente, por confirm_order_received (security
    -- definer, corre como postgres). El servidor escribiendo directo no puede.
    if new.status = 'delivered' and current_user <> 'postgres' then
      raise exception 'only_customer_confirms_delivery' using errcode = '42501';
    end if;

    case new.status
      when 'accepted' then new.accepted_at := now();
      when 'rejected' then new.rejected_at := now();
      when 'preparing' then new.preparing_at := now();
      when 'on_the_way' then new.on_the_way_at := now();
      when 'delivered' then new.delivered_at := now();
    end case;
  end if;

  if new.notify_status is distinct from old.notify_status
     or new.notify_error is distinct from old.notify_error then
    new.notify_updated_at := now();
  elsif new.notify_updated_at is distinct from old.notify_updated_at then
    raise exception 'order_notify_time_is_managed' using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."orders_guard"() TO "postgres";

COMMENT ON FUNCTION "public"."orders_guard"() IS 'Trigger de orders. Al insertar exige estado y aviso pendientes. Al actualizar: lo pedido es inmutable, los datos del cliente solo pasan a null, el estado solo avanza por order_status_transition_ok, entregado solo lo pone confirm_order_received y la hora de cada estado y del aviso la pone el trigger.';

REVOKE ALL ON FUNCTION "public"."orders_guard"() FROM PUBLIC;
