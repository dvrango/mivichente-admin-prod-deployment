-- Businesses outside the directory (mikitasks gr96hhp28).
--
-- Boscofee and Brune, two cafés in the city of Durango, use the stamp card and
-- the feedback discount but must not show up in the directory of the region
-- (Vicente Guerrero, Villa Unión, Súchil, Nombre de Dios). Plan:
-- `04 Execution/plans/Negocios fuera del directorio.md` (Obsidian vault).
--
-- is_demo already hides a business from the directory, but it also discards
-- its telemetry and allows repeated stamps on the same day
-- (20261111120000_demo_repeat_stamps.sql). A real business needs neither, so
-- hiding gets its own flag and is_demo becomes "hidden + demo behaviour".
--
-- Hiding reuses the three points from 20261110120000_business_is_demo.sql:
-- the anon policy on business_categories (every app listing joins it with
-- !inner, and the business page does not embed it), search_businesses and
-- businesses_open_now. Like the demo, the business still opens by link: its
-- page, stamp card, menu, feedback and /ordenar resolve it by slug.
--
-- The region's readings (weekly metrics, order funnel, daily orders) leave out
-- the contacts, taps and order events of a business outside the directory.
-- Its rows stay in their tables.

alter table public.businesses
  add column in_directory boolean not null default true;

comment on column public.businesses.in_directory is
  'False: the business opens by link (page, stamp card, menu, feedback, /ordenar) but does not appear in search, category listings, recommended or open-now, and the region metrics leave it out. Unlike is_demo it keeps its telemetry and the daily stamp limit. Only an admin changes it; a business set to Durango starts outside the directory.';

-- Municipios whose businesses start outside the directory. Durango is a
-- separate market without a directory (decision of 2026-10-16), so choosing it
-- turns the flag off on its own; an admin can turn it back on.
create function public.guard_business_in_directory()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  -- Only an admin sets the flag. Without this, the reviewer of a municipio
  -- could take a real business out of the directory. Same pattern as is_demo.
  if (
    (tg_op = 'INSERT' and not new.in_directory)
    or (tg_op = 'UPDATE' and old.in_directory is distinct from new.in_directory)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.in_directory'
      using errcode = '42501';
  end if;

  -- Checked against what the caller sent, so the default below does not
  -- count as a change made by a non-admin.
  if new.municipio = any (array['Durango'])
     and (tg_op = 'INSERT' or old.municipio is distinct from new.municipio) then
    new.in_directory := false;
  end if;

  return new;
end;
$function$;

comment on function public.guard_business_in_directory() is
  'Lets only admin (or postgres) change businesses.in_directory, and turns it off when a business is created in or moved to Durango.';

revoke all on function public.guard_business_in_directory() from public;

create trigger businesses_in_directory_guard
  before insert or update of in_directory, municipio on public.businesses
  for each row
  execute function public.guard_business_in_directory();

-- Helper for the anon policy. security definer so it does not depend on the
-- caller's RLS on businesses. A demo is never in the directory.
create function public.is_in_directory(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    (select b.in_directory and not b.is_demo
     from public.businesses b
     where b.id = p_business_id),
    false
  );
$function$;

comment on function public.is_in_directory(uuid) is
  'True if the business appears in the public directory: in_directory and not a demo. False with null or an unknown id.';

revoke all on function public.is_in_directory(uuid) from public;
grant execute on function public.is_in_directory(uuid) to anon, authenticated, service_role;

-- Listings: anon stops seeing the categories of a business outside the
-- directory. Staff keeps seeing them through business_categories_select_auth.
drop policy "business_categories_public_read" on public.business_categories;

create policy "business_categories_public_read" on public.business_categories
  for select
  to anon
  using (public.is_in_directory(business_id));

-- Search: same rule as the demo. Staff still finds the business from the
-- admin's business list and field search.
create or replace function public.search_businesses(search_query text)
returns setof public.businesses
language sql
stable
as $function$
  with q as (
    select unaccent(lower(trim(search_query))) as term
  ),
  tokens as (
    select distinct tok
    from q, regexp_split_to_table(q.term, '\s+') as tok
    where length(tok) >= 2
      and not public.is_search_stopword(tok)
  ),
  -- si el query es puro stopword/tokens cortos ("de la"), no dejamos la
  -- búsqueda sin señal: cae al término completo como único token
  effective_tokens as (
    select tok from tokens
    union all
    select term as tok from q where not exists (select 1 from tokens)
  ),
  scored as (
    select b.id, sum(public.business_term_score(b, t.tok)) as total_score
    from public.businesses b
    cross join effective_tokens t
    group by b.id
  )
  select b.*
  from public.businesses b
  join scored s on s.id = b.id
  cross join q
  where length(q.term) >= 2
    and s.total_score > 0
    -- demo businesses (rm3kdqga5) and businesses outside the directory
    -- (gr96hhp28) are left out of the public directory
    and ((b.in_directory and not b.is_demo) or public.is_staff())
  order by
    s.total_score desc,
    b.is_featured desc,
    b.name
  limit 50;
$function$;

create or replace function public.businesses_open_now()
returns setof public.businesses
language sql
stable
as $function$
  select b.*
  from public.businesses b
  where b.is_active = true
    and not b.is_demo
    and b.in_directory
    and exists (
      select 1
      from public.business_hours h
      cross join lateral (
        select
          (now() at time zone 'America/Mexico_City') as ts,
          (h.closes_at <= h.opens_at and h.closes_at <> time '00:00:00') as crosses
      ) c
      where h.business_id = b.id
        and (
          -- Tramo del día en curso. Si cruza la medianoche, cuenta desde la
          -- hora de apertura hasta el final del día.
          (
            h.day_of_week = extract(dow from c.ts)::int
            and c.ts::time >= h.opens_at
            and (c.crosses or h.closes_at = time '00:00:00'
                 or c.ts::time < h.closes_at)
          )
          -- Cola después de medianoche de un tramo que abrió ayer.
          or (
            h.day_of_week = ((extract(dow from c.ts)::int + 6) % 7)
            and c.crosses
            and c.ts::time < h.closes_at
          )
        )
    )
  order by b.name;
$function$;

-- Region metrics: events tied to a business outside the directory do not
-- count. search_events has no business_id and stays as it was.
create or replace function public.admin_weekly_metrics(
  p_now         timestamp with time zone default now(),
  p_weeks       integer                  default 6,
  p_window_days integer                  default 7
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
set search_path to 'public'
as $function$
  with params as (
    select
      p_now - make_interval(days => p_weeks * p_window_days) as since,
      p_window_days * 86400.0 as window_secs
  ),
  weeks as (
    select generate_series(0, p_weeks - 1) as week_index
  ),
  -- Businesses outside the directory (gr96hhp28): their contacts, taps and
  -- order events are not part of the region's readings.
  off_directory as (
    select b.id from businesses b where not b.in_directory
  ),
  -- Una fila por evento de cualquiera de las cuatro tablas con device_id: es
  -- la base de devices únicos y de los que regresan.
  activity as (
    select a.device_id, a.created_at
    from (
      select device_id, created_at from search_events
      union all
      select device_id, created_at from search_result_taps
      where business_id not in (select id from off_directory)
      union all
      select device_id, created_at from business_contacts
      where business_id not in (select id from off_directory)
      union all
      select device_id, created_at from order_funnel_events
      where business_id not in (select id from off_directory)
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
      and t.business_id not in (select id from off_directory)
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
      and c.business_id not in (select id from off_directory)
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

create or replace function public.admin_order_funnel(
  p_now         timestamp with time zone default now(),
  p_window_days integer                  default 7,
  p_long_days   integer                  default 30
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
set search_path to 'public'
as $function$
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
      -- businesses outside the directory are not part of the region (gr96hhp28)
      and exists (select 1 from businesses b where b.id = f.business_id and b.in_directory)
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

create or replace function public.admin_order_daily(
  p_now  timestamp with time zone default now(),
  p_days integer                  default 30
)
returns table (
  day           date,
  menu_devices  integer,
  intents       integer,
  intents_cents bigint
)
language sql
stable
set search_path to 'public'
as $function$
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
      -- businesses outside the directory are not part of the region (gr96hhp28)
      and exists (select 1 from businesses b where b.id = f.business_id and b.in_directory)
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
