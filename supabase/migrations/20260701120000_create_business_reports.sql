create table public.business_reports (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.business_reports enable row level security;

-- Cualquier usuario (incluso anónimo) puede insertar un reporte
create policy "anyone can report"
  on public.business_reports
  for insert
  to anon, authenticated
  with check (true);
