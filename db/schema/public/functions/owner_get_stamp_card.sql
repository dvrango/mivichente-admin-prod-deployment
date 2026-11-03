CREATE OR REPLACE FUNCTION public.owner_get_stamp_card (
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
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
declare
  v_holder public.stamp_card_holders%rowtype;
begin
  select * into v_holder
    from public.stamp_card_holders h
   where h.token = p_token;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not public.is_owner_of(v_holder.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;

  return query
  select
    oc.id,
    b.id,
    b.name,
    (b.is_active and b.stamp_card_active),
    coalesce(oc.reward, b.stamp_card_reward),
    coalesce(oc.stamps_required, b.stamp_card_stamps_required),
    coalesce(st.n, 0)::integer,
    coalesce(st.n >= oc.stamps_required, false),
    exists (
      select 1
        from public.stamp_card_stamps s
       where s.holder_id = v_holder.id
         and s.stamp_day = (now() at time zone 'America/Mexico_City')::date
    ),
    (
      select max(c.redeemed_at)
        from public.stamp_cards c
       where c.holder_id = v_holder.id
    )
  from public.businesses b
  left join public.stamp_cards oc
    on oc.holder_id = v_holder.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  where b.id = v_holder.business_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_get_stamp_card"(text) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_get_stamp_card"(text) IS 'Tarjeta de sellos por token para el panel del dueño. Error not_a_card si el token no es de ninguna tarjeta, not_your_business si es de un negocio que no es suyo. Devuelve la vuelta abierta (card_id null si no hay), si está llena y si ya recibió el sello de hoy.';

REVOKE ALL ON FUNCTION "public"."owner_get_stamp_card"(text) FROM PUBLIC;
