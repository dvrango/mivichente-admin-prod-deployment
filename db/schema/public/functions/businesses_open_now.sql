CREATE OR REPLACE FUNCTION public.businesses_open_now()
  RETURNS SETOF public.businesses
  LANGUAGE sql
  STABLE
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."businesses_open_now"() TO "anon", "authenticated", "postgres", "service_role";
