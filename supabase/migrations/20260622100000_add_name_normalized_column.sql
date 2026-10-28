-- Columna generada para búsqueda accent-insensitive en el admin.
-- Requiere la extensión unaccent (ya instalada en 20260614120000_search_normalization.sql).

-- unaccent() es STABLE, y una columna generada solo acepta expresiones IMMUTABLE:
-- con lower(unaccent(name)) el ALTER falla con 42P17. En prod la columna se rehízo
-- a mano con este wrapper, que nunca quedó en una migración; por eso `db reset`
-- se rompía aquí. La definición es la misma que tienen prod y local (2026-10-28).
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $function$ SELECT unaccent('unaccent', $1) $function$;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS name_normalized TEXT
    GENERATED ALWAYS AS (lower(immutable_unaccent(name))) STORED;

CREATE INDEX IF NOT EXISTS businesses_name_normalized_idx ON businesses (name_normalized);
