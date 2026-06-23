-- Columna generada para búsqueda accent-insensitive en el admin.
-- Requiere la extensión unaccent (ya instalada en 20260614120000_search_normalization.sql).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS name_normalized TEXT
    GENERATED ALWAYS AS (lower(unaccent(name))) STORED;

CREATE INDEX IF NOT EXISTS businesses_name_normalized_idx ON businesses (name_normalized);
