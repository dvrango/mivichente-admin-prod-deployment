-- Métricas semanales del admin agregadas en SQL.
--
-- Por qué: `getWeeklyMetrics()` bajaba las filas crudas de 6 semanas de
-- telemetría y agregaba en JS. PostgREST corta en 1000 filas por request y no
-- avisa: cuando `search_events` pasó de 1000 filas en la ventana (1334 el
-- 2026-10-02), las 1000 que regresaban sin `order` eran las más viejas y las
-- semanas recientes salían en 0 (mikitasks `su4z8tm09`). Agregar aquí hace que
-- lo que viaja sea una fila por semana, sin importar cuántos eventos haya.
--
-- La semántica es la misma que tenía el JS, a propósito:
--   - Semanas = ventanas de `p_window_days` hacia atrás desde `p_now`, no
--     semanas de calendario. Un evento con fecha futura (desfase de reloj) cae
--     en la semana 0; uno más viejo que la ventana total no entra.
--   - "Día" de un evento = fecha UTC del `created_at` (el JS hacía
--     `toISOString().slice(0, 10)`). Por eso `at time zone 'UTC'` y no
--     `::date`, que dependería del timezone de la sesión.
--   - Devices únicos y "que regresan" salen solo de `search_events`. Regresa
--     = visto en 2 o más días distintos dentro de la misma semana.
--   - Los devices de `excluded_devices` no cuentan en ninguna tabla.
--
-- `p_now` existe para poder comparar contra la implementación anterior con el
-- mismo instante. El admin la llama sin argumentos.
--
-- Autorización: `security invoker` y `execute` solo para `service_role`. El
-- admin la llama con el mismo cliente de service role que ya usaba para leer
-- estas tablas, y `requireAdmin()` sigue en `getWeeklyMetrics()`. Postgres y
-- Supabase le dan `execute` a public/anon/authenticated a toda función nueva,
-- por eso el revoke explícito: sin él la función quedaría abierta, aunque como
-- invoker un anon no vería filas (las tablas no le dan SELECT).

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
  ev as (
    select
      s.device_id,
      s.result_count,
      (s.created_at at time zone 'UTC')::date as day,
      greatest(0, least(p_weeks - 1,
        floor(extract(epoch from (p_now - s.created_at)) / params.window_secs)::integer
      )) as week_index
    from search_events s, params
    where s.created_at >= params.since
      and not exists (select 1 from excluded_devices e where e.device_id = s.device_id)
  ),
  search_stats as (
    select
      ev.week_index,
      count(distinct ev.device_id)::integer as unique_devices,
      count(*)::integer as searches,
      count(*) filter (where ev.result_count = 0)::integer as zero_result_searches
    from ev
    group by ev.week_index
  ),
  returning_stats as (
    select r.week_index, count(*)::integer as returning_devices
    from (
      select ev.week_index, ev.device_id
      from ev
      group by ev.week_index, ev.device_id
      having count(distinct ev.day) >= 2
    ) r
    group by r.week_index
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
    coalesce(s.unique_devices, 0),
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
  left join search_stats s on s.week_index = w.week_index
  left join returning_stats r on r.week_index = w.week_index
  left join tap_stats t on t.week_index = w.week_index
  left join contact_stats c on c.week_index = w.week_index
  order by w.week_index
$$;

comment on function public.admin_weekly_metrics(timestamptz, integer, integer) is
  'Métricas del admin por semana (week_index 0 = actual), excluyendo excluded_devices. Agrega en SQL porque PostgREST corta en 1000 filas. Solo service_role.';

-- Top de búsquedas sin resultado de la semana actual. "Semana actual" es lo
-- mismo que week_index 0 arriba: más reciente que p_now - p_window_days (borde
-- exclusivo, como el floor del JS) o con fecha futura. El término se normaliza
-- con trim + lower y los vacíos no cuentan. Empates: orden alfabético, para
-- que el resultado sea determinista (el JS dependía del orden de llegada).
create or replace function public.admin_top_zero_result_queries(
  p_now         timestamptz default now(),
  p_window_days integer     default 7,
  p_limit       integer     default 10
)
returns table (
  query    text,
  searches integer
)
language sql
stable
security invoker
set search_path = public
as $$
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
$$;

comment on function public.admin_top_zero_result_queries(timestamptz, integer, integer) is
  'Términos sin resultado más buscados en la semana actual, excluyendo excluded_devices. Solo service_role.';

revoke execute on function public.admin_weekly_metrics(timestamptz, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.admin_top_zero_result_queries(timestamptz, integer, integer)
  from public, anon, authenticated;

grant execute on function public.admin_weekly_metrics(timestamptz, integer, integer)
  to service_role;
grant execute on function public.admin_top_zero_result_queries(timestamptz, integer, integer)
  to service_role;
