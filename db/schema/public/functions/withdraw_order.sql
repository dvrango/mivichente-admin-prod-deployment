CREATE OR REPLACE FUNCTION public.withdraw_order (
  p_token text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_status text;
begin
  update public.orders o
     set status = 'withdrawn'
   where o.token = p_token
     and o.status = 'pending'
     and o.notify_status = 'pending'
     and o.created_at > now() - interval '60 seconds';

  if found then
    return 'withdrawn';
  end if;

  select o.status into v_status
    from public.orders o
   where o.token = p_token;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  -- A retry after an answer that got lost on the way.
  if v_status = 'withdrawn' then
    return 'withdrawn';
  end if;

  return 'too_late';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."withdraw_order"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."withdraw_order"(text) IS '«Cambiar algo» del contador: retira el pedido del token mientras el restaurante no tenga el aviso (pendiente, aviso pendiente y menos de 60 s de creado). Devuelve withdrawn (también si ya estaba retirado) o too_late si el aviso ya salió o la ventana pasó. Errores: order_not_found.';

REVOKE ALL ON FUNCTION "public"."withdraw_order"(text) FROM PUBLIC;
