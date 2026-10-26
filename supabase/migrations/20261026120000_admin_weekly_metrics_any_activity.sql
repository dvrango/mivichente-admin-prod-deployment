-- "Devices únicos" y "devices que regresan" cuentan cualquier actividad, no
-- solo búsquedas (mikitasks `es1d67kyq`).
--
-- Por qué: `admin_weekly_metrics` (20261002120000) sacaba los dos conteos de
-- `search_events`. Cuando se escribió, buscar era casi la única forma de usar
-- la app; hoy la mayoría llega directo a un menú por un link o un QR y nunca
-- busca. Al 10-oct, en la semana: 60 devices con búsquedas contra 147 con
-- cualquier actividad. La definición nueva es la decisión del 2026-10-10 ("Un
-- device que regresa es el que usa la app, no solo el que busca"): actividad
-- en `search_events`, `search_result_taps`, `business_contacts` u
-- `order_funnel_events`, y "regresa" = esa actividad en 2 o más días
-- distintos de la misma semana, sin importar en qué tabla cayó cada día.
--
-- `qr_scans` no entra: no tiene `device_id`.
--
-- La historia se recalcula: las 6 semanas salen de las tablas crudas con la
-- definición nueva, así que la tendencia del admin no salta. Lo que deja de
-- ser comparable son las cifras anotadas a mano antes (feed, Brújula). La
-- semana más vieja puede quedarse corta en `order_funnel_events`, que existe
-- desde el 2026-09-18.
--
-- Todo lo demás es igual que en 20261002120000: ventanas de `p_window_days`
-- hacia atrás desde `p_now`, días UTC, exclusión de `excluded_devices`, y
-- búsquedas, sin resultado, taps y contactos desde sus propias tablas. La firma
-- no cambia, así que el admin y los tipos generados tampoco.

create or replace function public.admin_weekly_metrics(
  p_now         timestamptz default now(),
  p_weeks       integer     default 6,
  p_window_days integer     default 7
)
returns table (
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
language sql
stable
security invoker
set search_path = public
as $$
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
$$;

comment on function public.admin_weekly_metrics(timestamptz, integer, integer) is
  'Métricas del admin por semana (week_index 0 = actual), excluyendo excluded_devices. Devices únicos y que regresan cuentan actividad en search_events, search_result_taps, business_contacts y order_funnel_events (desde 2026-10-26; antes solo search_events). Agrega en SQL porque PostgREST corta en 1000 filas. Solo service_role.';

-- `create or replace` conserva los privilegios de la función, pero se repiten
-- explícitos para que esta migración se sostenga sola: sin el revoke, la
-- función quedaría ejecutable por anon y authenticated.
revoke execute on function public.admin_weekly_metrics(timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_weekly_metrics(timestamptz, integer, integer)
  to service_role;
