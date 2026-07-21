-- Instrumentación mínima de búsqueda: qué se busca, cuántos resultados hubo.
-- device_id es un identificador anónimo generado en el cliente (mismo patrón
-- que favoritos, sin auth) que también viaja en business_reports.device_id
-- -- cruzarlos da retención real (dispositivos con actividad en 2+ días) y
-- detección de spam en reportes, sin depender de Play Console (que solo ve
-- Android nativo instalado, no la web app en app.vichente.com).

create table public.search_events (
  id           uuid primary key default gen_random_uuid(),
  device_id    text not null,
  query        text not null,
  result_count integer not null,
  created_at   timestamptz not null default now()
);

alter table public.search_events enable row level security;

create policy "anyone can log a search event"
  on public.search_events
  for insert
  to anon, authenticated
  with check (true);

grant insert on public.search_events to anon, authenticated;

alter table public.business_reports add column device_id text;
