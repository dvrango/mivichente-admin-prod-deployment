CREATE OR REPLACE FUNCTION public.resolve_customer_token (
  p_token text
)
  RETURNS TABLE (
    customer_id uuid,
    business_id uuid,
    linked      boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select t.customer_id, t.business_id, t.linked
    from (
      select bc.id as customer_id, bc.business_id, true as linked, 0 as priority
        from public.business_customers bc
       where bc.token = p_token
      union all
      select pc.customer_id, pc.business_id, pc.customer_id is not null, 1
        from public.physical_cards pc
       where pc.token = p_token
         and pc.revoked_at is null
    ) t
   order by t.priority
   limit 1
$function$;

GRANT EXECUTE ON FUNCTION "public"."resolve_customer_token"(text) TO "postgres";

COMMENT ON FUNCTION "public"."resolve_customer_token"(text) IS 'Interna. Del token de una tarjeta digital o física al cliente y su negocio. linked = false para una física sin asociar. Física revocada o token inexistente: sin filas. Es la única definición de qué token lleva a qué cliente.';

REVOKE ALL ON FUNCTION "public"."resolve_customer_token"(text) FROM PUBLIC;
