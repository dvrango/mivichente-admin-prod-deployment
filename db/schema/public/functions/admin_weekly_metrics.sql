CREATE OR REPLACE FUNCTION public.admin_weekly_metrics (
  p_now         timestamp with time zone DEFAULT now(),
  p_weeks       integer                  DEFAULT 6,
  p_window_days integer                  DEFAULT 7
)
  RETURNS TABLE (
    week_index           integer,
    unique_devices       integer,
    returning_devices    integer,
    searches             integer,
    zero_result_searches integer,
    business_taps        integer,
    contacts             integer,
    contacts_call        integer,
    contacts_whatsapp    integer,
    contacts_maps        integer,
    contacts_app         integer,
    contacts_landing     integer
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  with params as (
    select
      p_now - make_interval(days => p_weeks * p_window_days) as since,
      p_window_days * 86400.0 as window_secs
  ),
  weeks as (
    select generate_series(0, p_weeks - 1) as week_index
  ),
  -- Una fila por evento de cualquiera de las cuatro tablas con device_id: es
  -- la base de devices únicos y de los que regresan.
  activity as (
    select a.device_id, a.created_at
    from (
      select device_id, created_at from search_events
      union all
      select device_id, created_at from search_result_taps
      union all
      select device_id, created_at from business_contacts
      union all
      select device_id, created_at from order_funnel_events
    ) a, params
    where a.created_at >= params.since
      and not exists (select 1 from excluded_devices e where e.device_id = a.device_id)
  ),
  device_days as (
    select distinct
      greatest(0, least(p_weeks - 1,
        floor(extract(epoch from (p_now - activity.created_at)) / params.window_secs)::integer
      )) as week_index,
      activity.device_id,
      (activity.created_at at time zone 'UTC')::date as day
    from activity, params
  ),
  device_stats as (
    select
      d.week_index,
      count(distinct d.device_id)::integer as unique_devices
    from device_days d
    group by d.week_index
  ),
  returning_stats as (
    select r.week_index, count(*)::integer as returning_devices
    from (
      select d.week_index, d.device_id
      from device_days d
      group by d.week_index, d.device_id
      having count(distinct d.day) >= 2
    ) r
    group by r.week_index
  ),
  search_stats as (
    select
      greatest(0, least(p_weeks - 1,
        floor(extract(epoch from (p_now - s.created_at)) / params.window_secs)::integer
      )) as week_index,
      count(*)::integer as searches,
      count(*) filter (where s.result_count = 0)::integer as zero_result_searches
    from search_events s, params
    where s.created_at >= params.since
      and not exists (select 1 from excluded_devices e where e.device_id = s.device_id)
    group by 1
  ),
  tap_stats as (
    select
      greatest(0, least(p_weeks - 1,
        floor(extract(epoch from (p_now - t.created_at)) / params.window_secs)::integer
      )) as week_index,
      count(*)::integer as business_taps
    from search_result_taps t, params
    where t.created_at >= params.since
      and not exists (select 1 from excluded_devices e where e.device_id = t.device_id)
    group by 1
  ),
  contact_stats as (
    select
      greatest(0, least(p_weeks - 1,
        floor(extract(epoch from (p_now - c.created_at)) / params.window_secs)::integer
      )) as week_index,
      count(*)::integer as contacts,
      count(*) filter (where c.channel = 'call')::integer as contacts_call,
      count(*) filter (where c.channel = 'whatsapp')::integer as contacts_whatsapp,
      count(*) filter (where c.channel = 'maps')::integer as contacts_maps,
      count(*) filter (where c.source = 'app')::integer as contacts_app,
      count(*) filter (where c.source = 'landing')::integer as contacts_landing
    from business_contacts c, params
    where c.created_at >= params.since
      and not exists (select 1 from excluded_devices e where e.device_id = c.device_id)
    group by 1
  )
  select
    w.week_index,
    coalesce(d.unique_devices, 0),
    coalesce(r.returning_devices, 0),
    coalesce(s.searches, 0),
    coalesce(s.zero_result_searches, 0),
    coalesce(t.business_taps, 0),
    coalesce(c.contacts, 0),
    coalesce(c.contacts_call, 0),
    coalesce(c.contacts_whatsapp, 0),
    coalesce(c.contacts_maps, 0),
    coalesce(c.contacts_app, 0),
    coalesce(c.contacts_landing, 0)
  from weeks w
  left join device_stats d on d.week_index = w.week_index
  left join returning_stats r on r.week_index = w.week_index
  left join search_stats s on s.week_index = w.week_index
  left join tap_stats t on t.week_index = w.week_index
  left join contact_stats c on c.week_index = w.week_index
  order by w.week_index
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_weekly_metrics"(timestamp WITH time zone, integer, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."admin_weekly_metrics"(timestamp with time zone, integer, integer) IS 'Métricas del admin por semana (week_index 0 = actual), excluyendo excluded_devices. Devices únicos y que regresan cuentan actividad en search_events, search_result_taps, business_contacts y order_funnel_events (desde 2026-10-26; antes solo search_events). Agrega en SQL porque PostgREST corta en 1000 filas. Solo service_role.';

REVOKE ALL ON FUNCTION "public"."admin_weekly_metrics"(timestamp WITH time zone, integer, integer) FROM PUBLIC;
