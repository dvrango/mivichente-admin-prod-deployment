CREATE OR REPLACE FUNCTION public.admin_top_zero_result_queries (
  p_now         timestamp with time zone DEFAULT now(),
  p_window_days integer                  DEFAULT 7,
  p_limit       integer                  DEFAULT 10
)
  RETURNS TABLE (
    query    text,
    searches integer
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select q.term, count(*)::integer
  from (
    select lower(regexp_replace(s.query, '^\s+|\s+$', '', 'g')) as term
    from search_events s
    where s.result_count = 0
      and s.created_at > p_now - make_interval(days => p_window_days)
      and not exists (select 1 from excluded_devices e where e.device_id = s.device_id)
  ) q
  where q.term <> ''
  group by q.term
  order by count(*) desc, q.term asc
  limit p_limit
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_top_zero_result_queries"(timestamp WITH time zone, integer, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."admin_top_zero_result_queries"(timestamp with time zone, integer, integer) IS 'Términos sin resultado más buscados en la semana actual, excluyendo excluded_devices. Solo service_role.';

REVOKE ALL ON FUNCTION "public"."admin_top_zero_result_queries"(timestamp WITH time zone, integer, integer) FROM PUBLIC;
