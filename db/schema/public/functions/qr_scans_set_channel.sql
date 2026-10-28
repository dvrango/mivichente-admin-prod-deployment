CREATE OR REPLACE FUNCTION public.qr_scans_set_channel()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if public.qr_scan_is_bot(new.user_agent) then
    new.channel := 'bot';
  else
    new.channel := public.qr_scan_channel_from_src(new.src);
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."qr_scans_set_channel"() TO "postgres";
