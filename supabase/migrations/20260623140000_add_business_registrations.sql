-- business_registrations: solicitudes de registro desde la app mobile.
-- INSERT público (anon), SELECT/UPDATE solo admin (authenticated).

create table public.business_registrations (
  id             uuid        primary key default gen_random_uuid(),
  business_name  text        not null,
  description    text        not null,
  phone          text        not null,
  contact_phone  text,
  contact_name   text        not null,
  municipio      text        not null,
  status         text        not null default 'pending',
  notes          text,
  created_at     timestamptz not null default now(),

  constraint business_registrations_status_check
    check (status in ('pending', 'reviewed', 'approved', 'rejected'))
);

alter table public.business_registrations enable row level security;

-- App mobile (anon) puede insertar
create policy "anon_insert_business_registrations"
  on public.business_registrations
  for insert
  to anon, authenticated
  with check (true);

-- Solo admin (authenticated) puede leer
create policy "admin_select_business_registrations"
  on public.business_registrations
  for select
  to authenticated
  using (true);

-- Solo admin puede actualizar status/notes
create policy "admin_update_business_registrations"
  on public.business_registrations
  for update
  to authenticated
  using (true)
  with check (true);
