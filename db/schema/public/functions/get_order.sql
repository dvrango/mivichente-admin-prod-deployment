CREATE OR REPLACE FUNCTION public.get_order (
  p_token text
)
  RETURNS TABLE (
    business_id        uuid,
    status             text,
    mode               text,
    items              jsonb,
    subtotal_cents     integer,
    delivery_fee_cents integer,
    total_cents        integer,
    notify_status      text,
    created_at         timestamp with time zone,
    accepted_at        timestamp with time zone,
    rejected_at        timestamp with time zone,
    preparing_at       timestamp with time zone,
    on_the_way_at      timestamp with time zone,
    delivered_at       timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select o.business_id, o.status, o.mode, o.items, o.subtotal_cents,
         o.delivery_fee_cents, o.total_cents, o.notify_status, o.created_at,
         o.accepted_at, o.rejected_at, o.preparing_at, o.on_the_way_at,
         o.delivered_at
    from public.orders o
   where o.token = p_token;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_order"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."get_order"(text) IS 'El pedido del token, sin datos del cliente (nombre, teléfono, ubicación): quien tiene el token ya los conoce, y un token filtrado expone menos. Token inexistente: sin filas.';

REVOKE ALL ON FUNCTION "public"."get_order"(text) FROM PUBLIC;
