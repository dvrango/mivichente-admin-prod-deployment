-- Add municipio (fixed list, validated in app) and colonia (free text) to businesses.
-- Existing rows default to 'Vicente Guerrero'.

ALTER TABLE businesses
  ADD COLUMN municipio text NOT NULL DEFAULT 'Vicente Guerrero',
  ADD COLUMN colonia   text;

CREATE INDEX ON businesses(municipio);
