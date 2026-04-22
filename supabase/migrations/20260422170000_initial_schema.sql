-- Vichente App 2.0 — schema inicial
-- Fuente de verdad: 007 Tech/Database Schema.md

-- ============================================================
-- Tablas
-- ============================================================

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text,
  type       text not null check (type in ('food', 'business')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category_id uuid references public.categories(id) on delete set null,
  phone       text not null,
  address     text,
  schedule    text,
  photo_url   text,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists businesses_category_id_idx on public.businesses (category_id);
create index if not exists businesses_is_active_idx   on public.businesses (is_active);

-- ============================================================
-- Trigger: mantener businesses.updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
before update on public.businesses
for each row
execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.categories enable row level security;
alter table public.businesses enable row level security;

-- Lectura pública — solo activos se exponen a la app
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
  on public.categories
  for select
  using (is_active = true);

drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read
  on public.businesses
  for select
  using (is_active = true);

-- Escritura y lectura completa — solo usuarios autenticados (admin)
drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all
  on public.categories
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists businesses_admin_all on public.businesses;
create policy businesses_admin_all
  on public.businesses
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Storage: bucket business-photos (lectura pública, escritura admin)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('business-photos', 'business-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "business-photos public read" on storage.objects;
create policy "business-photos public read"
  on storage.objects
  for select
  using (bucket_id = 'business-photos');

drop policy if exists "business-photos admin write" on storage.objects;
create policy "business-photos admin write"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'business-photos')
  with check (bucket_id = 'business-photos');
