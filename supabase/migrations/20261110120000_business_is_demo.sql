-- Negocios demo (mikitasks rm3kdqga5).
--
-- Las demos a dueños de negocio se hacían con negocios reales y dejaban sellos,
-- escaneos y contactos en ellos. Un negocio demo funciona igual que uno real y
-- se abre por link, pero no sale en el directorio (búsqueda, listados por
-- categoría, recomendados, «abierto ahora») y no registra telemetría.
--
-- Ocultarlo por la RLS de `businesses` no sirve: anon tampoco podría abrirlo
-- por link, igual que con is_active = false. Lo que se oculta son sus filas de
-- `business_categories`: todos los listados de la app entran por
-- `business_categories!inner` y la ficha no embebe esa tabla, así que el demo
-- sale de los listados también en los builds ya instalados.

alter table public.businesses
  add column is_demo boolean not null default false;

comment on column public.businesses.is_demo is
  'Negocio para demostraciones. Se abre por link (ficha, tarjeta, menú, opinión) pero no aparece en búsqueda, listados ni «abierto ahora», y su telemetría se descarta. Solo un admin lo cambia.';

-- Helper para la policy de business_categories y los triggers de telemetría.
-- security definer para no depender de la RLS de businesses de quien llama.
-- Con null (qr_scans de stickers) devuelve false.
create function public.is_demo_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    (select b.is_demo from public.businesses b where b.id = p_business_id),
    false
  );
$function$;

comment on function public.is_demo_business(uuid) is
  'True si el negocio está marcado como demo. False con null o con un id que no existe.';

revoke all on function public.is_demo_business(uuid) from public;
grant execute on function public.is_demo_business(uuid) to anon, authenticated, service_role;

-- Solo admin marca o desmarca un demo. La policy businesses_update deja
-- escribir al revisor de su municipio; sin este guard, un revisor podría sacar
-- del directorio un negocio real. Mismo patrón que accepts_orders.
create function public.guard_business_is_demo_admin()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if (
    (tg_op = 'INSERT' and new.is_demo)
    or (tg_op = 'UPDATE' and old.is_demo is distinct from new.is_demo)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.is_demo'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

comment on function public.guard_business_is_demo_admin() is
  'Impide que cualquier identidad de aplicación distinta de admin marque o desmarque un negocio demo. Solo exceptúa postgres para operación de infraestructura.';

revoke all on function public.guard_business_is_demo_admin() from public;

create trigger businesses_is_demo_admin_only
  before insert or update of is_demo on public.businesses
  for each row
  execute function public.guard_business_is_demo_admin();

-- Listados: anon deja de ver las categorías de un demo. El staff las sigue
-- viendo por business_categories_select_auth.
drop policy "business_categories_public_read" on public.business_categories;

create policy "business_categories_public_read" on public.business_categories
  for select
  to anon
  using (not public.is_demo_business(business_id));

-- Búsqueda: el público no ve el demo; el staff sí, para encontrarlo desde la
-- lista de negocios y la búsqueda de campo del admin. El preview de búsqueda
-- del admin usa el cliente anónimo y lo excluye, como la app.
-- is_staff() devuelve false para anon (auth.uid() es null), pero necesita
-- execute para que la función no truene cuando la llama anon.
grant execute on function public.is_staff() to anon;

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
    -- negocios demo: fuera del directorio público (rm3kdqga5)
    and (not b.is_demo or public.is_staff())
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

-- Telemetría: un insert con un negocio demo se descarta en silencio (el
-- trigger devuelve null). Se prefiere a un WITH CHECK porque el cliente no
-- recibe error: la app y la landing ya tratan estos inserts como best-effort.
-- El nombre ordena este trigger antes de qr_scans_set_channel_trigger (los
-- BEFORE se disparan por orden alfabético); si descarta, ese ya no corre.
create function public.discard_demo_telemetry()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if public.is_demo_business(new.business_id) then
    return null;
  end if;
  return new;
end;
$function$;

comment on function public.discard_demo_telemetry() is
  'Descarta (return null) los inserts de telemetría de un negocio demo: search_result_taps, qr_scans, business_contacts y order_funnel_events.';

revoke all on function public.discard_demo_telemetry() from public;

create trigger search_result_taps_discard_demo
  before insert on public.search_result_taps
  for each row
  execute function public.discard_demo_telemetry();

create trigger qr_scans_discard_demo
  before insert on public.qr_scans
  for each row
  execute function public.discard_demo_telemetry();

create trigger business_contacts_discard_demo
  before insert on public.business_contacts
  for each row
  execute function public.discard_demo_telemetry();

create trigger order_funnel_events_discard_demo
  before insert on public.order_funnel_events
  for each row
  execute function public.discard_demo_telemetry();

-- El primer demo ya existe en prod y hoy sale en la búsqueda: se marca aquí
-- para que salga del directorio en cuanto se aplique la migración, sin esperar
-- al deploy del admin. En una base sin ese negocio no hace nada.
update public.businesses
set is_demo = true
where id = '1e140a3f-c29a-46cb-b060-a65d1f630c99';
