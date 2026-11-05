CREATE OR REPLACE FUNCTION public.stamp_card_owner_state (
  p_customer_id uuid
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
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
       where s.customer_id = bc.id
         and s.stamp_day = (now() at time zone 'America/Mexico_City')::date
    ),
    (
      select max(c.redeemed_at)
        from public.stamp_cards c
       where c.customer_id = bc.id
    )
  from public.business_customers bc
  join public.businesses b on b.id = bc.business_id
  left join public.stamp_cards oc
    on oc.customer_id = bc.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  where bc.id = p_customer_id
$function$;

GRANT EXECUTE ON FUNCTION "public"."stamp_card_owner_state"(uuid) TO "postgres";

COMMENT ON FUNCTION "public"."stamp_card_owner_state"(uuid) IS 'Interna. Estado de la tarjeta de sellos de un cliente para el panel del dueño: vuelta abierta (card_id null si no hay), si está llena y si ya recibió el sello de hoy. No revisa permisos.';

REVOKE ALL ON FUNCTION "public"."stamp_card_owner_state"(uuid) FROM PUBLIC;
