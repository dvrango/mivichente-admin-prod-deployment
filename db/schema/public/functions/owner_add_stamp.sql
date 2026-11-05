CREATE OR REPLACE FUNCTION public.owner_add_stamp (
  p_token text
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
  v_ref      record;
  v_card     public.stamp_cards%rowtype;
  v_card_id  uuid;
  v_today    date := (now() at time zone 'America/Mexico_City')::date;
  v_stamps   integer;
begin
  select * into v_ref from public.resolve_customer_token(p_token);

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not public.is_owner_of(v_ref.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  if not v_ref.linked then
    raise exception 'card_not_linked' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from public.businesses b
     where b.id = v_ref.business_id
       and b.is_active
       and b.stamp_card_active
  ) then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;

  v_card_id := public.stamp_card_open_card(v_ref.customer_id);
  if v_card_id is null then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;

  select * into v_card
    from public.stamp_cards c
   where c.id = v_card_id
     for update;

  if exists (
    select 1
      from public.stamp_card_stamps s
     where s.customer_id = v_ref.customer_id
       and s.stamp_day = v_today
  ) then
    raise exception 'already_stamped_today' using errcode = 'P0001';
  end if;

  select count(*) into v_stamps
    from public.stamp_card_stamps s
   where s.card_id = v_card.id;

  if v_stamps >= v_card.stamps_required then
    raise exception 'card_full' using errcode = 'P0001';
  end if;

  -- El índice único (customer_id, stamp_day) decide si dos escaneos llegan juntos.
  begin
    insert into public.stamp_card_stamps (card_id, customer_id, stamp_day, stamped_by)
    values (v_card.id, v_ref.customer_id, v_today, auth.uid());
  exception when unique_violation then
    raise exception 'already_stamped_today' using errcode = 'P0001';
  end;

  return query select * from public.stamp_card_owner_state(v_ref.customer_id);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_add_stamp"(text) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_add_stamp"(text) IS 'Da un sello a la tarjeta del token (digital o física asociada) si es de un negocio del dueño. Uno por cliente y día (hora de Durango), sin importar con qué tarjeta. Errores: not_a_card, not_your_business, card_not_linked, stamp_card_not_available, already_stamped_today, card_full. Devuelve el estado después del sello.';

REVOKE ALL ON FUNCTION "public"."owner_add_stamp"(text) FROM PUBLIC;
