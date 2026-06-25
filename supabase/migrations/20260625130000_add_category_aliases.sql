-- Add aliases/synonyms to categories so search resolves popular or regional terms
-- that map to a category name (e.g. "lonches" -> "Fondas", "abarrotes" -> "Tienda").
ALTER TABLE categories ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';

-- Extend search to also match the business category name + its aliases.
CREATE OR REPLACE FUNCTION public.search_businesses(search_query text)
RETURNS setof public.businesses
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT b.*
  FROM public.businesses b
  LEFT JOIN public.categories c ON c.id = b.category_id
  WHERE b.is_active = true
    AND (
      unaccent(lower(b.name)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(b.aliases) a
        WHERE unaccent(lower(a)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
           OR unaccent(lower(trim(search_query))) ILIKE '%' || unaccent(lower(a)) || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(b.offerings) o
        WHERE unaccent(lower(o)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
      )
      OR unaccent(lower(coalesce(c.name, ''))) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(c.aliases) ca
        WHERE unaccent(lower(ca)) ILIKE '%' || unaccent(lower(trim(search_query))) || '%'
           OR unaccent(lower(trim(search_query))) ILIKE '%' || unaccent(lower(ca)) || '%'
      )
    )
  ORDER BY b.name;
$$;
