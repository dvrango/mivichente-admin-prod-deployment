-- Add description, social links, and offerings to businesses
ALTER TABLE businesses
  ADD COLUMN description   text,
  ADD COLUMN facebook_url  text,
  ADD COLUMN instagram_url text,
  ADD COLUMN offerings     text[] NOT NULL DEFAULT '{}';

CREATE INDEX businesses_offerings_gin ON businesses USING GIN (offerings);

-- Extend search to include offerings
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
      OR EXISTS (
        SELECT 1 FROM unnest(offerings) o
        WHERE unaccent(lower(o)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
      )
    )
  ORDER BY name;
$$;
