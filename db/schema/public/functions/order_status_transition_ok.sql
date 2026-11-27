CREATE OR REPLACE FUNCTION public.order_status_transition_ok (
  p_from text,
  p_to   text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select (p_from, p_to) in (
    ('pending', 'accepted'),
    ('pending', 'rejected'),
    ('pending', 'withdrawn'),
    ('accepted', 'preparing'),
    ('preparing', 'on_the_way'),
    ('on_the_way', 'delivered')
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."order_status_transition_ok"(text, text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."order_status_transition_ok"(text, text) IS 'Los únicos pasos válidos del pedido: pendiente → aceptado, rechazado o retirado por el cliente; aceptado → en preparación → en camino → entregado. Rechazado, entregado y retirado son finales. set_order_status no acepta retirado: solo withdraw_order lo pone.';

REVOKE ALL ON FUNCTION "public"."order_status_transition_ok"(text, text) FROM PUBLIC;
