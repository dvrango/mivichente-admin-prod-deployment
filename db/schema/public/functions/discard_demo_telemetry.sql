CREATE OR REPLACE FUNCTION public.discard_demo_telemetry()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if public.is_demo_business(new.business_id) then
    return null;
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."discard_demo_telemetry"() TO "postgres";

COMMENT ON FUNCTION "public"."discard_demo_telemetry"() IS 'Descarta (return null) los inserts de telemetría de un negocio demo: search_result_taps, qr_scans, business_contacts y order_funnel_events.';

REVOKE ALL ON FUNCTION "public"."discard_demo_telemetry"() FROM PUBLIC;
