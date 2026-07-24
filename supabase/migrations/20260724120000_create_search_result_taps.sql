-- Segundo nivel de instrumentación de búsqueda: qué resultado ABRIÓ el usuario.
-- search_events dice qué se buscó y cuántos resultados hubo, pero result_count
-- engaña: la búsqueda multi-palabra tokeniza, así que "tacos el molinete"
-- (un negocio que no existe) devuelve 15 tacos genéricos -> result_count=15 se
-- ve exitoso pero fue un miss oculto. Registrar el tap al perfil desde un
-- resultado permite ligar query -> negocio abierto: un query con resultados
-- pero SIN tap es la señal más limpia de "esto no lo tengo cargado".
-- Mismo device_id anónimo que search_events / business_reports para cruzar.

create table public.search_result_taps (
  id           uuid primary key default gen_random_uuid(),
  device_id    text not null,
  query        text not null,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.search_result_taps enable row level security;

create policy "anyone can log a search result tap"
  on public.search_result_taps
  for insert
  to anon, authenticated
  with check (true);

grant insert on public.search_result_taps to anon, authenticated;
