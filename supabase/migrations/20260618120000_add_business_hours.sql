-- business_hours: structured weekly schedule per business
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
-- absent row = closed that day

CREATE TABLE business_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  UNIQUE (business_id, day_of_week)
);

-- RLS: same visibility as businesses
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_hours_public_read"
  ON business_hours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_hours.business_id
        AND b.is_active = true
    )
  );

CREATE POLICY "business_hours_admin_write"
  ON business_hours FOR ALL
  USING (auth.role() = 'service_role');

-- index for fast lookup by business
CREATE INDEX idx_business_hours_business_id ON business_hours(business_id);
