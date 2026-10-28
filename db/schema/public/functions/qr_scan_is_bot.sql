CREATE OR REPLACE FUNCTION public.qr_scan_is_bot (
  p_user_agent text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select coalesce(
    p_user_agent ~* '(bot|crawler|spider|facebookexternalhit|meta-externalagent|meta-webindexer|^whatsapp/|^curl/|headless|python-requests|go-http-client|panscient|dataprovider|builtwith)'
    and p_user_agent !~* 'cubot',
    false
  )
$function$;

GRANT EXECUTE ON FUNCTION "public"."qr_scan_is_bot"(text) TO "postgres";

COMMENT ON FUNCTION "public"."qr_scan_is_bot"(text) IS 'True si el user-agent es de un crawler o generador de vistas previas (WhatsApp, Facebook, buscadores). El trigger de qr_scans les asigna channel = bot.';
