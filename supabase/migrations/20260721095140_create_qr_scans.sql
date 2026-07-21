create table public.qr_scans (
  id         uuid primary key default gen_random_uuid(),
  src        text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.qr_scans enable row level security;

-- Cualquier visitante (incluso anónimo) que entra por /app dispara un insert;
-- no hay sesión en ese punto, así que no puede restringirse a authenticated.
create policy "anyone can log a qr scan"
  on public.qr_scans
  for insert
  to anon, authenticated
  with check (true);
