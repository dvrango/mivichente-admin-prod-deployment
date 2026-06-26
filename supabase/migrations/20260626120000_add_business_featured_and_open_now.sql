-- is_featured: negocios destacados/recomendados, curados manualmente por Vichente
-- (NO por usuarios). Distinto de is_verified: verified = el dato es confiable,
-- featured = Vichente lo recomienda/promociona.
alter table businesses
  add column if not exists is_featured boolean not null default false;

-- businesses_open_now: negocios abiertos en este momento según su horario.
-- Timezone fijo America/Mexico_City (Durango = Centro), NO hora del teléfono.
-- Un negocio SIN horario cargado NO aparece (no podemos saber si está abierto).
-- LIMITACIÓN MVP: no soporta cruce de medianoche (asume opens_at < closes_at).
create or replace function public.businesses_open_now()
returns setof public.businesses
language sql
stable
security invoker
as $$
  select b.*
  from public.businesses b
  join public.business_hours h on h.business_id = b.id
  where b.is_active = true
    and h.day_of_week = extract(dow from (now() at time zone 'America/Mexico_City'))::int
    and (now() at time zone 'America/Mexico_City')::time >= h.opens_at
    and (now() at time zone 'America/Mexico_City')::time <  h.closes_at
  order by b.name;
$$;

grant execute on function public.businesses_open_now() to anon, authenticated;
