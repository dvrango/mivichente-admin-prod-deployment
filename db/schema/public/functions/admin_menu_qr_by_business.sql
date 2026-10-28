CREATE OR REPLACE FUNCTION public.admin_menu_qr_by_business (
  p_now         timestamp with time zone DEFAULT now(),
  p_window_days integer                  DEFAULT 7
)
  RETURNS TABLE (
    business_id   uuid,
    business_name text,
    scans         integer,
    scans_prev    integer,
    last_scan_at  timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select
    q.business_id,
    b.name,
    count(*) filter (where q.created_at > p_now - make_interval(days => p_window_days))::integer,
    count(*) filter (
      where q.created_at <= p_now - make_interval(days => p_window_days)
        and q.created_at > p_now - make_interval(days => 2 * p_window_days)
    )::integer,
    max(q.created_at)
  from qr_scans q
  join businesses b on b.id = q.business_id
  where q.channel = 'menu-qr'
    and q.created_at <= p_now
  group by q.business_id, b.name
  order by max(q.created_at) desc
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_menu_qr_by_business"(timestamp WITH time zone, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."admin_menu_qr_by_business"(timestamp with time zone, integer) IS 'Scans de menu-qr por negocio (ventana actual y anterior) y fecha del último. Solo service_role.';

REVOKE ALL ON FUNCTION "public"."admin_menu_qr_by_business"(timestamp WITH time zone, integer) FROM PUBLIC;
