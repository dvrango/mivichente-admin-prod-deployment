CREATE OR REPLACE FUNCTION public.link_physical_card (
  p_token          text,
  p_device_id      text,
  p_customer_token text DEFAULT NULL::text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_card     public.physical_cards%rowtype;
  v_customer public.business_customers%rowtype;
  v_device   text := nullif(btrim(p_device_id), '');
  v_ctoken   text := nullif(btrim(p_customer_token), '');
begin
  -- Orden de bloqueo fijo: primero el cliente y después la física. El cliente
  -- bloqueado serializa dos físicas distintas para el mismo cliente (el índice
  -- único parcial respalda); la física bloqueada serializa dos asociaciones de
  -- la misma física. Al revés, reasociar la física vigente y asociar una nueva
  -- al mismo cliente a la vez podían trabarse (40P01). Los errores se revisan
  -- después, en el orden de siempre.
  if v_ctoken is not null then
    select * into v_customer
      from public.business_customers bc
     where bc.token = v_ctoken
       for update;
  end if;

  select * into v_card
    from public.physical_cards pc
   where pc.token = p_token
     and pc.revoked_at is null
     for update;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.businesses b where b.id = v_card.business_id and b.is_active
  ) then
    raise exception 'card_not_available' using errcode = 'P0001';
  end if;

  if v_ctoken is not null then
    if v_customer.id is null then
      raise exception 'invalid_customer_token' using errcode = 'P0001';
    end if;
    if v_customer.business_id <> v_card.business_id then
      raise exception 'wrong_business' using errcode = 'P0001';
    end if;
  end if;

  if v_card.customer_id is not null then
    if v_customer.id is not null and v_card.customer_id = v_customer.id then
      return v_customer.token;
    end if;
    raise exception 'card_already_linked' using errcode = 'P0001';
  end if;

  if v_customer.id is null then
    if v_device is null or char_length(v_device) > 100 then
      raise exception 'invalid_device_id' using errcode = '22023';
    end if;
    insert into public.business_customers (business_id, device_id)
    values (v_card.business_id, v_device)
    on conflict (business_id, device_id) do nothing
    returning * into v_customer;
    if v_customer.id is null then
      raise exception 'already_has_card' using errcode = 'P0001';
    end if;
  else
    -- Primero se revoca la anterior: el índice único parcial no deja dos
    -- vigentes ni por un instante.
    update public.physical_cards pc
       set revoked_at = now()
     where pc.customer_id = v_customer.id
       and pc.revoked_at is null;
  end if;

  update public.physical_cards pc
     set customer_id = v_customer.id,
         linked_at   = now()
   where pc.id = v_card.id;

  perform public.stamp_card_open_card(v_customer.id);

  return v_customer.token;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."link_physical_card"(text, text, text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."link_physical_card"(text, text, text) IS 'Asocia una tarjeta física sin asociar al cliente que la escanea y regresa el token de su digital. Con p_customer_token la asocia a ese cliente (mismo negocio) y revoca su física anterior; sin él crea el cliente para ese celular. Errores: not_a_card, card_not_available, invalid_customer_token, wrong_business, card_already_linked, already_has_card, invalid_device_id.';

REVOKE ALL ON FUNCTION "public"."link_physical_card"(text, text, text) FROM PUBLIC;
