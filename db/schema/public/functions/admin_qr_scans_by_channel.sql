CREATE OR REPLACE FUNCTION public.admin_qr_scans_by_channel (
  p_now         timestamp with time zone DEFAULT now(),
  p_window_days integer                  DEFAULT 7
)
  RETURNS TABLE (
    channel    text,
    scans      integer,
    scans_prev integer
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select
    q.channel,
    count(*) filter (where q.created_at > p_now - make_interval(days => p_window_days))::integer,
    count(*) filter (where q.created_at <= p_now - make_interval(days => p_window_days))::integer
  from qr_scans q
  where q.created_at > p_now - make_interval(days => 2 * p_window_days)
    and q.created_at <= p_now
  group by q.channel
  order by 2 desc, 3 desc, q.channel
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_qr_scans_by_channel"(timestamp WITH time zone, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."admin_qr_scans_by_channel"(timestamp with time zone, integer) IS 'Scans de qr_scans por canal, ventana actual y anterior. Solo service_role.';

REVOKE ALL ON FUNCTION "public"."admin_qr_scans_by_channel"(timestamp WITH time zone, integer) FROM PUBLIC;
