CREATE OR REPLACE FUNCTION public.owner_redeem_stamp_card (
  p_card_id uuid
)
  RETURNS TABLE (
    card_id             uuid,
    business_id         uuid,
    business_name       text,
    program_active      boolean,
    reward              text,
    stamps_required     integer,
    stamps              integer,
    is_full             boolean,
    stamped_today       boolean,
    last_redeemed_at    timestamp with time zone,
    daily_limit_applies boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
declare
  v_card     public.stamp_cards%rowtype;
  v_customer public.business_customers%rowtype;
  v_stamps   integer;
begin
  select * into v_card
    from public.stamp_cards c
   where c.id = p_card_id
;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;

  select * into v_customer
    from public.business_customers bc
   where bc.id = v_card.customer_id;

  if not public.is_owner_of(v_customer.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  -- Mismo orden que owner_add_stamp: negocio -> cliente -> vuelta.
  -- La lectura inicial solo localiza al cliente; el estado se relee bloqueado.
  perform 1 from public.businesses b
   where b.id = v_customer.business_id for share;
  perform 1 from public.business_customers bc
   where bc.id = v_customer.id for update;
  select * into v_card from public.stamp_cards c
   where c.id = p_card_id for update;

  if v_card.redeemed_at is not null then
    raise exception 'already_redeemed' using errcode = 'P0001';
  end if;

  select count(*) into v_stamps
    from public.stamp_card_stamps s
   where s.card_id = v_card.id;

  if v_stamps < v_card.stamps_required then
    raise exception 'card_not_full' using errcode = 'P0001';
  end if;

  update public.stamp_cards c
     set redeemed_at = now(),
         redeemed_by = auth.uid()
   where c.id = v_card.id
     and c.redeemed_at is null;

  perform public.stamp_card_open_card(v_customer.id);

  return query select * from public.stamp_card_owner_state(v_customer.id);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) IS 'Canjea el premio de una vuelta llena de un negocio del dueño, una sola vez, y abre la vuelta siguiente si el programa sigue prendido. Errores: not_a_card, not_your_business, already_redeemed, card_not_full. Devuelve el estado de la tarjeta después del canje.';

REVOKE ALL ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) FROM PUBLIC;
