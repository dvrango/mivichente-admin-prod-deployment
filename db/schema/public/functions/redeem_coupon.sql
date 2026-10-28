CREATE OR REPLACE FUNCTION public.redeem_coupon (
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
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
begin
  update public.coupons c
     set redeemed_at = now()
   where c.token = p_token
     and c.redeemed_at is null
     and c.expires_at > now();

  return query select * from public.get_coupon(p_token);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."redeem_coupon"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."redeem_coupon"(text) IS 'Marca usado el cupón del token, una sola vez y solo si no ha vencido. Devuelve el estado después del intento (misma forma que get_coupon).';

REVOKE ALL ON FUNCTION "public"."redeem_coupon"(text) FROM PUBLIC;
