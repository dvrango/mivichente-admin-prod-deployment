-- Panel de solo lectura para dueños de negocios elegidos (tarea of2zdfxa6).
-- Plan: 04 Execution/plans/Panel de solo lectura para dueños.md (vault).
--
-- El usuario le crea la cuenta a mano al dueño, le pone rol `owner` y la liga a
-- su negocio en `business_owners`. El dueño ve su ficha tal como la ven los
-- clientes y pide cualquier cambio por WhatsApp: no edita nada.
--
-- Autorización: el dueño NO gana ningún grant ni policy sobre las tablas del
-- negocio. Todo lo que lee pasa por dos funciones security definer con la regla
-- en un solo lugar, igual que los cupones (20261010130000). Así:
--   - no puede escribir nada por construcción: no hay policy que lo deje;
--   - no hace falta sumarle una policy a cada una de las ~8 tablas que lee, que
--     en `businesses` se habría OR-eado con las del staff;
--   - aunque un día alguien agregue una policy de más, sigue sin poder listar
--     filas sueltas.
--
-- Lo que NO se toca: is_staff(), is_admin(), user_municipio() y
-- can_edit_business() ya filtran por `role in ('admin','reviewer')` o por
-- `role = 'admin'`, así que dan false para `owner` sin cambiarlos. Un `owner`
-- con municipio puesto por error tampoco hereda escritura: user_municipio() le
-- devuelve null.

-- ============================================================
-- 1. Rol `owner`
-- ============================================================

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'reviewer', 'pending', 'owner'));

comment on column public.profiles.role is
  'admin | reviewer | pending | owner. `pending` es el default de toda cuenta nueva y no da acceso a nada: un admin le asigna rol y municipio desde el dashboard de Supabase. `owner` es el dueño de un negocio: solo lee sus negocios (ver business_owners) vía owner_business_snapshot(). No existe policy de UPDATE sobre profiles, así que nadie se autopromueve.';

-- ============================================================
-- 2. Qué negocio es de qué cuenta
-- ============================================================

create table public.business_owners (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, business_id)
);

create index business_owners_business_idx on public.business_owners (business_id);

comment on table public.business_owners is
  'Negocios que ve cada cuenta con rol owner. Un dueño puede tener varios. La mantiene el usuario desde SQL; ninguna cuenta de la aplicación escribe aquí.';

alter table public.business_owners enable row level security;

-- Supabase hereda grants amplios por default privileges. El admin la lee; nadie
-- de la aplicación escribe. El dueño tampoco la lee directo: sus negocios le
-- llegan por owner_businesses().
revoke all on public.business_owners from anon, authenticated;
grant select on public.business_owners to authenticated;

create policy "admin reads business owners"
  on public.business_owners
  for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. Lecturas del dueño
-- ============================================================

-- Única definición de "esta cuenta es dueña de este negocio". La usan las dos
-- funciones de abajo. No se le da execute a nadie: solo la llaman ellas.
create or replace function public.is_owner_of(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_owners o
    join public.profiles p on p.id = o.profile_id
    where o.profile_id = auth.uid()
      and p.role = 'owner'
      and o.business_id = p_business_id
  );
$$;

comment on function public.is_owner_of(uuid) is
  'True si la cuenta actual tiene rol owner y el negocio está ligado a ella en business_owners. Punto único de la regla de lectura del panel del dueño.';

create or replace function public.owner_businesses()
returns table (id uuid, name text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.slug
  from public.businesses b
  where public.is_owner_of(b.id)
  order by b.name;
$$;

comment on function public.owner_businesses() is
  'Negocios de la cuenta actual si es owner. Vacío para cualquier otro rol.';

-- Columnas listadas una por una a propósito: un `to_jsonb(b)` le pasaría al
-- dueño cualquier columna que se agregue mañana a businesses, incluidas las
-- internas. Servicios: solo los publicados, que es lo que ven los clientes. Los
-- de show_in_profile = false sí van, porque el menú de mesa los enseña; la UI los
-- marca.
create or replace function public.owner_business_snapshot(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'description', b.description,
      'category', (select c.name from public.categories c where c.id = b.category_id),
      'phone', b.phone,
      'phone_is_whatsapp', b.phone_is_whatsapp,
      'whatsapp_phone', b.whatsapp_phone,
      'address', b.address,
      'colonia', b.colonia,
      'municipio', b.municipio,
      'maps_url', b.maps_url,
      'facebook_url', b.facebook_url,
      'instagram_url', b.instagram_url,
      'photo_url', b.photo_url,
      'offerings', b.offerings,
      'services_label', b.services_label,
      'has_delivery', b.has_delivery,
      'is_active', b.is_active,
      'promo_active', b.promo_active,
      'promo_title', b.promo_title,
      'promo_body', b.promo_body,
      'promo_ends_at', b.promo_ends_at
    ),
    'hours', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day_of_week', h.day_of_week,
          'opens_at', h.opens_at,
          'closes_at', h.closes_at
        )
        order by h.day_of_week, h.opens_at
      )
      from public.business_hours h
      where h.business_id = b.id
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', ph.id, 'url', ph.url, 'caption', ph.caption, 'kind', ph.kind)
        order by ph.order_index
      )
      from public.business_photos ph
      where ph.business_id = b.id
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'price', s.price,
          'section', s.section,
          'show_in_profile', s.show_in_profile,
          'variants', coalesce((
            select jsonb_agg(
              jsonb_build_object('name', v.name, 'price', v.price)
              order by v.order_index
            )
            from public.business_service_variants v
            where v.service_id = s.id
          ), '[]'::jsonb),
          'option_groups', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', g.name,
                'options', coalesce((
                  select jsonb_agg(
                    jsonb_build_object('name', o.name, 'price_delta', o.price_delta)
                    order by o.order_index
                  )
                  from public.business_service_options o
                  where o.group_id = g.id
                ), '[]'::jsonb)
              )
              order by g.order_index
            )
            from public.business_service_option_groups g
            where g.service_id = s.id
          ), '[]'::jsonb)
        )
        order by s.order_index
      )
      from public.business_services s
      where s.business_id = b.id
        and s.is_published
    ), '[]'::jsonb),
    'feedback', jsonb_build_object(
      'total', (select count(*) from public.business_feedback f where f.business_id = b.id),
      'recent', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'rating', f.rating,
            'liked', f.liked,
            'improve', f.improve,
            'created_at', f.created_at
          )
          order by f.created_at desc
        )
        from (
          select rating, liked, improve, created_at
          from public.business_feedback
          where business_id = b.id
          order by created_at desc
          limit 50
        ) f
      ), '[]'::jsonb)
    )
  )
  from public.businesses b
  where b.id = p_business_id
    and public.is_owner_of(b.id);
$$;

comment on function public.owner_business_snapshot(uuid) is
  'Ficha de un negocio para el panel del dueño: datos públicos, horarios, fotos, servicios publicados y las 50 opiniones más recientes con el total. Null si la cuenta no es owner o el negocio no está ligado a ella.';

-- Postgres y Supabase dan execute a toda función nueva. Solo authenticated: el
-- panel corre con sesión. anon no tiene nada que hacer aquí.
revoke all on function public.is_owner_of(uuid) from public, anon, authenticated;
revoke all on function public.owner_businesses() from public, anon, authenticated;
revoke all on function public.owner_business_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.owner_businesses() to authenticated;
grant execute on function public.owner_business_snapshot(uuid) to authenticated;
