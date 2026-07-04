-- Roles multi-usuario en el admin panel (acceso por municipio).
-- Antes: cualquier usuario autenticado tenía CRUD total (businesses_admin_all).
-- Ahora: rol 'admin' (acceso total) vs 'reviewer' (scope a su municipio, sin delete).
-- Plan: 08 Execution/plans/Roles en admin panel.md

-- ============================================================
-- Tabla profiles
-- ============================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'reviewer' check (role in ('admin', 'reviewer')),
  municipio  text,                                 -- null = admin (sin restricción de municipio)
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario lee sólo su propio perfil (para getCurrentProfile en la app).
-- Sin policies de insert/update/delete desde cliente: altas y cambios de
-- rol/municipio se hacen sólo vía dashboard de Supabase o service role.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

grant select on public.profiles to authenticated;

-- ============================================================
-- Trigger: cada signup nuevo -> row en profiles con default 'reviewer'
-- ============================================================
-- Nota v2.1: si se agrega self-registro de dueños de negocio, ese es un rol
-- distinto ('owner', scope = su propio negocio) y choca con este default.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill: usuarios ya existentes sin perfil (yo me promuevo a admin a mano después).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ============================================================
-- Helper functions (security definer sobre profiles para no repetir subquery)
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.user_municipio()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select municipio from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- RLS businesses: reemplazar businesses_admin_all por policies por operación
-- ============================================================

drop policy if exists businesses_admin_all on public.businesses;

-- El public_read original no tenía rol -> también aplicaba a authenticated y
-- OR-eaba con la policy scopeada, filtrando TODOS los negocios activos al
-- reviewer sin importar su municipio. Se restringe a anon (la app mobile).
drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read
  on public.businesses
  for select
  to anon
  using (is_active = true);

create policy businesses_select
  on public.businesses
  for select
  to authenticated
  using (public.is_admin() or municipio = public.user_municipio());

create policy businesses_insert
  on public.businesses
  for insert
  to authenticated
  with check (public.is_admin() or municipio = public.user_municipio());

create policy businesses_update
  on public.businesses
  for update
  to authenticated
  using (public.is_admin() or municipio = public.user_municipio())
  with check (public.is_admin() or municipio = public.user_municipio());

create policy businesses_delete
  on public.businesses
  for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- RLS categories: catálogo legible por cualquier authenticated,
-- escritura sólo admin. Sin esto un reviewer podría escribir vía API.
-- ============================================================

drop policy if exists categories_admin_all on public.categories;

-- public_read a anon (la app mobile). El authenticated lee vía categories_select_auth.
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
  on public.categories
  for select
  to anon
  using (is_active = true);

create policy categories_select_auth
  on public.categories
  for select
  to authenticated
  using (true);

create policy categories_insert
  on public.categories
  for insert
  to authenticated
  with check (public.is_admin());

create policy categories_update
  on public.categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy categories_delete
  on public.categories
  for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- RLS business_categories: no hereda el filtro por el FK — subquery explícita
-- al municipio del negocio padre. (public_read sigue abierto para la app.)
-- ============================================================

drop policy if exists business_categories_admin_all on public.business_categories;

-- public_read tenía `to public` (todos los roles) -> el reviewer leía las
-- categorías de negocios de cualquier municipio. Se restringe a anon.
drop policy if exists business_categories_public_read on public.business_categories;
create policy business_categories_public_read
  on public.business_categories
  for select
  to anon
  using (true);

create policy business_categories_select_auth
  on public.business_categories
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (public.is_admin() or b.municipio = public.user_municipio())
    )
  );

create policy business_categories_insert
  on public.business_categories
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (public.is_admin() or b.municipio = public.user_municipio())
    )
  );

create policy business_categories_delete
  on public.business_categories
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (public.is_admin() or b.municipio = public.user_municipio())
    )
  );

-- ============================================================
-- RLS business_hours: mismo scoping. El select para authenticated ya no lo
-- cubre business_hours_admin_all (se elimina); el public_read es sólo anon.
-- ============================================================

drop policy if exists business_hours_admin_all on public.business_hours;

create policy business_hours_select_auth
  on public.business_hours
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (public.is_admin() or b.municipio = public.user_municipio())
    )
  );

create policy business_hours_insert
  on public.business_hours
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (public.is_admin() or b.municipio = public.user_municipio())
    )
  );

create policy business_hours_delete
  on public.business_hours
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and (public.is_admin() or b.municipio = public.user_municipio())
    )
  );

-- ============================================================
-- RLS business_registrations: sólo admin lee/actualiza (reviewer no las ve).
-- El insert anón desde la app mobile se mantiene.
-- ============================================================

drop policy if exists admin_select_business_registrations on public.business_registrations;
create policy admin_select_business_registrations
  on public.business_registrations
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists admin_update_business_registrations on public.business_registrations;
create policy admin_update_business_registrations
  on public.business_registrations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Storage business-photos: la policy existente ("business-photos admin write")
-- ya permite escritura a cualquier authenticated, así que el reviewer puede
-- subir fotos. No se scopea por municipio: la foto se sube ANTES de insertar el
-- negocio y su path es un uuid aleatorio sin link al negocio, así que no hay
-- municipio con qué filtrar en el momento del upload. El daño de un upload
-- huérfano es mínimo; la asociación real la protege el RLS de businesses.
