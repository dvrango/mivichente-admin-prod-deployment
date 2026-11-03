CREATE OR REPLACE FUNCTION public.owner_redeem_stamp_card (
  p_card_id uuid
)
  RETURNS TABLE (
    card_id          uuid,
    business_id      uuid,
    business_name    text,
    program_active   boolean,
    reward           text,
    stamps_required  integer,
    stamps           integer,
    is_full          boolean,
    stamped_today    boolean,
    last_redeemed_at timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
declare
  v_card   public.stamp_cards%rowtype;
  v_holder public.stamp_card_holders%rowtype;
  v_stamps integer;
begin
  select * into v_card
    from public.stamp_cards c
   where c.id = p_card_id
     for update;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;

  select * into v_holder
    from public.stamp_card_holders h
   where h.id = v_card.holder_id;

  if not public.is_owner_of(v_holder.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
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

  perform public.stamp_card_open_card(v_holder.id);

  return query select * from public.owner_get_stamp_card(v_holder.token);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) IS 'Canjea el premio de una vuelta llena de un negocio del dueño, una sola vez, y abre la vuelta siguiente si el programa sigue prendido. Errores: not_a_card, not_your_business, already_redeemed, card_not_full. Devuelve el estado de la tarjeta después del canje.';

REVOKE ALL ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) FROM PUBLIC;
