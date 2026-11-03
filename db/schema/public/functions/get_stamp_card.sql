CREATE OR REPLACE FUNCTION public.get_stamp_card (
  p_token text
)
  RETURNS TABLE (
    business_name        text,
    business_slug        text,
    program_active       boolean,
    reward               text,
    stamps_required      integer,
    stamps               integer,
    is_full              boolean,
    last_stamp_at        timestamp with time zone,
    last_redeemed_at     timestamp with time zone,
    last_redeemed_reward text,
    server_now           timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    b.name,
    b.slug,
    (b.is_active and b.stamp_card_active),
    coalesce(oc.reward, b.stamp_card_reward),
    coalesce(oc.stamps_required, b.stamp_card_stamps_required),
    coalesce(st.n, 0)::integer,
    coalesce(st.n >= oc.stamps_required, false),
    st.last_at,
    lr.redeemed_at,
    lr.reward,
    now()
  from public.stamp_card_holders h
  join public.businesses b on b.id = h.business_id
  left join public.stamp_cards oc
    on oc.holder_id = h.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n, max(s.created_at) as last_at
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  left join lateral (
    select c.redeemed_at, c.reward
      from public.stamp_cards c
     where c.holder_id = h.id
       and c.redeemed_at is not null
     order by c.redeemed_at desc
     limit 1
  ) lr on true
  where h.token = p_token
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_stamp_card"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."get_stamp_card"(text) IS 'Estado de una tarjeta de sellos por su token: negocio, si el programa sigue prendido, premio y sellos de la vuelta abierta, si está llena, último sello y último canje. Sin token válido no devuelve filas.';

REVOKE ALL ON FUNCTION "public"."get_stamp_card"(text) FROM PUBLIC;
