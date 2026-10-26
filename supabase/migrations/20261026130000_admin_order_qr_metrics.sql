-- Embudo del pedido y scans de QR en /metrics del admin (mikitasks `tjc3k2h1k`).
--
-- Por qué: del 3 al 10 de octubre el embudo se leyó 6 veces y los QR 2 veces con
-- SQL a mano contra prod, cada vez con filtros un poco distintos. Estas funciones
-- fijan una sola lectura. Agregan en SQL por la misma razón que
-- `admin_weekly_metrics` (20261002120000): PostgREST corta en 1000 filas sin
-- avisar, así que lo que viaja son filas ya agregadas.
--
-- Semántica compartida:
--   - Ventanas de `p_window_days` hacia atrás desde `p_now`: la actual es
--     (p_now - N días, p_now] y la anterior es la de antes. A diferencia de
--     `admin_weekly_metrics`, lo posterior a `p_now` NO entra: así se puede
--     validar contra una fecha pasada y dar el número exacto.
--   - `excluded_devices` se excluye en `order_funnel_events`. `qr_scans` no tiene
--     `device_id`; ahí los bots ya vienen separados en `channel = 'bot'`.
--   - Una intención de pedido = un `whatsapp_opened` por `device_id` +
--     `business_id` en el mismo bloque fijo de media hora (`floor(epoch / 1800)`:
--     10:28 y 10:31 caen en bloques distintos), la regla de lectura del plan
--     "Embudo del pedido". El monto es el del último evento del bloque: el pedido que el cliente terminó mandando. Una
--     intención no es un pedido confirmado.
--   - La serie diaria usa el día local (America/Monterrey, la zona de Durango),
--     no UTC: un pedido a las 18:00 cae en el día siguiente en UTC (pasó el
--     4-oct). Las ventanas de 7 días no dependen de la medianoche.
--
-- Autorización, los mismos dos candados que las de la Etapa 1: `security
-- invoker` + `execute` solo para `service_role` (revoke explícito, porque
-- Postgres y Supabase dan `execute` a toda función nueva), y `requireAdmin()`
-- dentro del lector de `queries.ts`. Los datos dicen cuánto vende cada negocio.

-- Embudo por negocio, ventana actual contra la anterior, más intenciones en
-- `p_long_days`. Una fila por negocio con eventos en alguna de las dos ventanas
-- o con intenciones en `p_long_days`, y una fila de total con `business_id`
-- null: el total cuenta devices
-- distintos en todo el embudo, porque sumar por negocio contaría dos veces a
-- quien vio dos menús.
create or replace function public.admin_order_funnel(
  p_now         timestamptz default now(),
  p_window_days integer     default 7,
  p_long_days   integer     default 30
)
returns table (
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
language sql
stable
security invoker
set search_path = public
as $$
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
$$;

comment on function public.admin_order_funnel(timestamptz, integer, integer) is
  'Embudo del pedido por negocio (ventana actual y anterior) e intenciones deduplicadas por device + negocio en 30 min. Fila con business_id null = total con devices distintos. Excluye excluded_devices. Solo service_role.';

-- Serie diaria de los últimos `p_days` días locales (America/Monterrey),
-- incluido el de hoy, con los días sin eventos en 0: devices que vieron algún
-- menú e intenciones de pedido. Sirve para ver cuándo hubo un empujón y cuándo
-- se apaga.
create or replace function public.admin_order_daily(
  p_now  timestamptz default now(),
  p_days integer     default 30
)
returns table (
  day           date,
  menu_devices  integer,
  intents       integer,
  intents_cents bigint
)
language sql
stable
security invoker
set search_path = public
as $$
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
$$;

comment on function public.admin_order_daily(timestamptz, integer) is
  'Serie diaria (día local America/Monterrey) de devices que vieron un menú e intenciones de pedido deduplicadas. Excluye excluded_devices. Solo service_role.';

-- Scans de QR por canal, ventana actual contra la anterior. Salen todos los
-- canales que tengan scans en alguna de las dos; `bot` es uno más y la pantalla
-- lo separa.
create or replace function public.admin_qr_scans_by_channel(
  p_now         timestamptz default now(),
  p_window_days integer     default 7
)
returns table (
  channel    text,
  scans      integer,
  scans_prev integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    q.channel,
    count(*) filter (where q.created_at > p_now - make_interval(days => p_window_days))::integer,
    count(*) filter (where q.created_at <= p_now - make_interval(days => p_window_days))::integer
  from qr_scans q
  where q.created_at > p_now - make_interval(days => 2 * p_window_days)
    and q.created_at <= p_now
  group by q.channel
  order by 2 desc, 3 desc, q.channel
$$;

comment on function public.admin_qr_scans_by_channel(timestamptz, integer) is
  'Scans de qr_scans por canal, ventana actual y anterior. Solo service_role.';

-- Scans del QR de mesa (`menu-qr`) por negocio: los de la ventana actual y la
-- anterior, y la fecha del último aunque sea más vieja. Contesta "¿sigue el QR
-- en la mesa?" sin preguntarle al dueño. Salen todos los negocios que alguna vez
-- tuvieron un scan de `menu-qr`.
create or replace function public.admin_menu_qr_by_business(
  p_now         timestamptz default now(),
  p_window_days integer     default 7
)
returns table (
  business_id   uuid,
  business_name text,
  scans         integer,
  scans_prev    integer,
  last_scan_at  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
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
$$;

comment on function public.admin_menu_qr_by_business(timestamptz, integer) is
  'Scans de menu-qr por negocio (ventana actual y anterior) y fecha del último. Solo service_role.';

revoke execute on function public.admin_order_funnel(timestamptz, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.admin_order_daily(timestamptz, integer)
  from public, anon, authenticated;
revoke execute on function public.admin_qr_scans_by_channel(timestamptz, integer)
  from public, anon, authenticated;
revoke execute on function public.admin_menu_qr_by_business(timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.admin_order_funnel(timestamptz, integer, integer)
  to service_role;
grant execute on function public.admin_order_daily(timestamptz, integer)
  to service_role;
grant execute on function public.admin_qr_scans_by_channel(timestamptz, integer)
  to service_role;
grant execute on function public.admin_menu_qr_by_business(timestamptz, integer)
  to service_role;
