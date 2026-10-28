CREATE OR REPLACE FUNCTION public.get_coupon (
  p_token text
)
  RETURNS TABLE (
    business_name text,
    business_slug text,
    benefit       text,
    status        text,
    valid_until   date,
    expires_at    timestamp with time zone,
    redeemed_at   timestamp with time zone,
    created_at    timestamp with time zone,
    server_now    timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    b.name,
    b.slug,
    c.benefit,
    case
      when c.redeemed_at is not null then 'used'
      when c.expires_at <= now()     then 'expired'
      else                                'valid'
    end,
    ((c.expires_at at time zone 'America/Mexico_City')::date - 1),
    c.expires_at,
    c.redeemed_at,
    c.created_at,
    now()
  from public.coupons c
  join public.businesses b on b.id = c.business_id
  where c.token = p_token
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_coupon"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."get_coupon"(text) IS 'Estado de un cupón por su token: valid / used / expired, más el negocio, el beneficio, el último día válido (valid_until, hora de Durango) y la hora del servidor. Sin token válido no devuelve filas.';

REVOKE ALL ON FUNCTION "public"."get_coupon"(text) FROM PUBLIC;
