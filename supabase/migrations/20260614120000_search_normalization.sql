-- Normalización de búsqueda con unaccent
-- Fix: "Ferreteria" sin acento daba cero resultados

create extension if not exists unaccent;

create or replace function public.search_businesses(search_query text)
returns setof public.businesses
language sql
stable
security invoker
as $$
  select * from public.businesses
  where is_active = true
    and unaccent(lower(name)) ilike '%' || unaccent(lower(trim(search_query))) || '%'
  order by name;
$$;
