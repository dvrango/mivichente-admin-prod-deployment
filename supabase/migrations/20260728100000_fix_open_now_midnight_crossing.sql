-- businesses_open_now: soporte para horarios que cruzan la medianoche.
--
-- Antes se asumía `opens_at < closes_at`, así que un negocio con horario
-- 17:30–02:00 (tacos, bares, alitas) nunca aparecía en el filtro "Abiertos
-- ahora". Al 2026-07-27 son 150 de 1,582 filas de business_hours (9.5%) — justo
-- los negocios nocturnos, que es cuando el filtro más vale.
--
-- Reglas (las mismas que `BusinessHoursUtils` en Flutter, para que el badge de
-- la ficha y este filtro no diverjan):
--   * `closes_at = 00:00` significa "cierra a medianoche exacta" = fin del día,
--     NO un rango vacío ni un cruce.
--   * Un tramo cruza la medianoche si `closes_at <= opens_at` (excluyendo el
--     caso de arriba). Su parte después de las 00:00 pertenece al día ANTERIOR.
-- Timezone fijo America/Mexico_City (Durango = Centro), NO hora del teléfono.
-- Un negocio SIN horario cargado sigue sin aparecer (no podemos saber si abre).
create or replace function public.businesses_open_now()
returns setof public.businesses
language sql
stable
security invoker
as $$
  select b.*
  from public.businesses b
  where b.is_active = true
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
$$;

grant execute on function public.businesses_open_now() to anon, authenticated;
