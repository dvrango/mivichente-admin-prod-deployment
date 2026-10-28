CREATE OR REPLACE FUNCTION public.qr_scan_channel_from_src (
  p_src text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select case
    when p_src is null               then null
    when p_src like 'share%'         then 'share'
    when p_src like 'menu-qr%'       then 'menu-qr'
    when p_src like 'opinion-qr%'    then 'opinion-qr'
    when p_src like 'sticker%'       then 'sticker'
    when p_src like 'post-ig%'       then 'post-ig'
    when p_src like 'post-fb%'       then 'post-fb'
    when p_src like 'fb-post%'       then 'post-fb'
    when p_src = 'landing-banner'    then 'landing'
    else                                  'otro'
  end
$function$;

GRANT EXECUTE ON FUNCTION "public"."qr_scan_channel_from_src"(text) TO "postgres";
