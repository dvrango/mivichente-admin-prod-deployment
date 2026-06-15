-- Add aliases array to businesses for popular/informal name search
ALTER TABLE businesses ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';

-- Update search function to include aliases
CREATE OR REPLACE FUNCTION public.search_businesses(search_query text)
RETURNS setof public.businesses
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT * FROM public.businesses
  WHERE is_active = true
    AND (
      unaccent(lower(name)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(aliases) a
        WHERE unaccent(lower(a)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
           OR unaccent(lower(trim(search_query))) ILIKE '%' || unaccent(lower(a)) || '%'
      )
    )
  ORDER BY name;
$$;
