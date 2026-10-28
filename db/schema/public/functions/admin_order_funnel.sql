CREATE OR REPLACE FUNCTION public.admin_order_funnel (
  p_now         timestamp with time zone DEFAULT now(),
  p_window_days integer                  DEFAULT 7,
  p_long_days   integer                  DEFAULT 30
)
  RETURNS TABLE (
    business_id        uuid,
    business_name      text,
    viewed             integer,
    viewed_prev        integer,
    added              integer,
    added_prev         integer,
    checkout           integer,
    checkout_prev      integer,
    whatsapp           integer,
    whatsapp_prev      integer,
    intents            integer,
    intents_prev       integer,
    intents_cents      bigint,
    intents_cents_prev bigint,
    intents_long       integer,
    intents_cents_long bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  with params as (
    select
      p_now - make_interval(days => p_window_days)     as cur_since,
      p_now - make_interval(days => 2 * p_window_days) as prev_since,
      p_now - make_interval(days => greatest(p_long_days, 2 * p_window_days)) as since
  ),
  ev as (
    select
      f.device_id,
      f.business_id,
      f.step,
      f.total_cents,
      f.created_at,
      case
        when f.created_at > params.cur_since then 0
        when f.created_at > params.prev_since then 1
      end as w,
      f.created_at > p_now - make_interval(days => p_long_days) as in_long
    from order_funnel_events f, params
    where f.created_at > params.since
      and f.created_at <= p_now
      and not exists (select 1 from excluded_devices e where e.device_id = f.device_id)
  ),
  intents as (
    select distinct on (ev.device_id, ev.business_id, floor(extract(epoch from ev.created_at) / 1800))
      ev.business_id,
      ev.total_cents,
      ev.w,
      ev.in_long
    from ev
    where ev.step = 'whatsapp_opened'
    order by ev.device_id, ev.business_id, floor(extract(epoch from ev.created_at) / 1800),
      ev.created_at desc
  ),
  funnel as (
    select
      ev.business_id,
      grouping(ev.business_id) = 1 as is_total,
      count(distinct ev.device_id) filter (where ev.step = 'menu_viewed' and ev.w = 0)::integer      as viewed,
      count(distinct ev.device_id) filter (where ev.step = 'menu_viewed' and ev.w = 1)::integer      as viewed_prev,
      count(distinct ev.device_id) filter (where ev.step = 'item_added' and ev.w = 0)::integer       as added,
      count(distinct ev.device_id) filter (where ev.step = 'item_added' and ev.w = 1)::integer       as added_prev,
      count(distinct ev.device_id) filter (where ev.step = 'checkout_started' and ev.w = 0)::integer as checkout,
      count(distinct ev.device_id) filter (where ev.step = 'checkout_started' and ev.w = 1)::integer as checkout_prev,
      count(distinct ev.device_id) filter (where ev.step = 'whatsapp_opened' and ev.w = 0)::integer  as whatsapp,
      count(distinct ev.device_id) filter (where ev.step = 'whatsapp_opened' and ev.w = 1)::integer  as whatsapp_prev
    from ev
    group by grouping sets ((ev.business_id), ())
  ),
  intent_stats as (
    select
      i.business_id,
      grouping(i.business_id) = 1 as is_total,
      count(*) filter (where i.w = 0)::integer                     as intents,
      count(*) filter (where i.w = 1)::integer                     as intents_prev,
      coalesce(sum(i.total_cents) filter (where i.w = 0), 0)::bigint as intents_cents,
      coalesce(sum(i.total_cents) filter (where i.w = 1), 0)::bigint as intents_cents_prev,
      count(*) filter (where i.in_long)::integer                   as intents_long,
      coalesce(sum(i.total_cents) filter (where i.in_long), 0)::bigint as intents_cents_long
    from intents i
    group by grouping sets ((i.business_id), ())
  )
  select
    case when f.is_total then null else f.business_id end,
    case when f.is_total then null else b.name end,
    f.viewed,
    f.viewed_prev,
    f.added,
    f.added_prev,
    f.checkout,
    f.checkout_prev,
    f.whatsapp,
    f.whatsapp_prev,
    coalesce(s.intents, 0),
    coalesce(s.intents_prev, 0),
    coalesce(s.intents_cents, 0),
    coalesce(s.intents_cents_prev, 0),
    coalesce(s.intents_long, 0),
    coalesce(s.intents_cents_long, 0)
  from funnel f
  left join intent_stats s
    on s.is_total = f.is_total
   and (f.is_total or s.business_id = f.business_id)
  left join businesses b on b.id = f.business_id and not f.is_total
  -- Un negocio sin eventos en las dos ventanas solo sale si tuvo intenciones
  -- en `p_long_days`; si no, sería una fila de ceros.
  where f.is_total
     or f.viewed + f.viewed_prev + f.added + f.added_prev
        + f.checkout + f.checkout_prev + f.whatsapp + f.whatsapp_prev > 0
     or coalesce(s.intents_long, 0) > 0
  -- El total primero; después los negocios con más vistas.
  order by f.is_total desc, f.viewed desc, f.viewed_prev desc, b.name
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_order_funnel"(timestamp WITH time zone, integer, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."admin_order_funnel"(timestamp with time zone, integer, integer) IS 'Embudo del pedido por negocio (ventana actual y anterior) e intenciones deduplicadas por device + negocio en 30 min. Fila con business_id null = total con devices distintos. Excluye excluded_devices. Solo service_role.';

REVOKE ALL ON FUNCTION "public"."admin_order_funnel"(timestamp WITH time zone, integer, integer) FROM PUBLIC;
