CREATE OR REPLACE FUNCTION public.get_card_entry (
  p_token text
)
  RETURNS TABLE (
    status          text,
    business_name   text,
    business_slug   text,
    active_mechanic text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    case when r.linked then 'linked' else 'unlinked' end,
    b.name,
    b.slug,
    case when b.is_active and b.stamp_card_active then 'stamp_card' end
  from public.resolve_customer_token(p_token) r
  join public.businesses b on b.id = r.business_id
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_card_entry"(text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."get_card_entry"(text) IS 'Entrada de la ruta /t/{token}: si la tarjeta está sin asociar (unlinked) o asociada (linked), el negocio y la mecánica activa (stamp_card, o null si no tiene nada activo y toca mandar a la ficha). Física revocada o token inexistente: sin filas.';

REVOKE ALL ON FUNCTION "public"."get_card_entry"(text) FROM PUBLIC;
