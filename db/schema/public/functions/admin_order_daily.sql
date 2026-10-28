CREATE OR REPLACE FUNCTION public.admin_order_daily (
  p_now  timestamp with time zone DEFAULT now(),
  p_days integer                  DEFAULT 30
)
  RETURNS TABLE (
    day           date,
    menu_devices  integer,
    intents       integer,
    intents_cents bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  with params as (
    select (p_now at time zone 'America/Monterrey')::date as today
  ),
  days as (
    select generate_series(params.today - (p_days - 1), params.today, interval '1 day')::date as day
    from params
  ),
  ev as (
    select
      f.device_id,
      f.business_id,
      f.step,
      f.total_cents,
      f.created_at,
      (f.created_at at time zone 'America/Monterrey')::date as day
    from order_funnel_events f, params
    where f.created_at >= ((params.today - (p_days - 1))::timestamp at time zone 'America/Monterrey')
      and f.created_at <= p_now
      and not exists (select 1 from excluded_devices e where e.device_id = f.device_id)
  ),
  views as (
    select ev.day, count(distinct ev.device_id)::integer as menu_devices
    from ev
    where ev.step = 'menu_viewed'
    group by ev.day
  ),
  intents as (
    select distinct on (ev.device_id, ev.business_id, floor(extract(epoch from ev.created_at) / 1800))
      ev.day,
      ev.total_cents
    from ev
    where ev.step = 'whatsapp_opened'
    order by ev.device_id, ev.business_id, floor(extract(epoch from ev.created_at) / 1800),
      ev.created_at desc
  ),
  intent_stats as (
    select i.day, count(*)::integer as intents, coalesce(sum(i.total_cents), 0)::bigint as intents_cents
    from intents i
    group by i.day
  )
  select d.day, coalesce(v.menu_devices, 0), coalesce(s.intents, 0), coalesce(s.intents_cents, 0)
  from days d
  left join views v on v.day = d.day
  left join intent_stats s on s.day = d.day
  order by d.day
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_order_daily"(timestamp WITH time zone, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."admin_order_daily"(timestamp with time zone, integer) IS 'Serie diaria (día local America/Monterrey) de devices que vieron un menú e intenciones de pedido deduplicadas. Excluye excluded_devices. Solo service_role.';

REVOKE ALL ON FUNCTION "public"."admin_order_daily"(timestamp WITH time zone, integer) FROM PUBLIC;
