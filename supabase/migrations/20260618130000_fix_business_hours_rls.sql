-- Fix RLS policies to match businesses table pattern:
-- anon = public read (active businesses only), authenticated = full access

DROP POLICY IF EXISTS "business_hours_public_read" ON business_hours;
DROP POLICY IF EXISTS "business_hours_admin_write" ON business_hours;

CREATE POLICY "business_hours_public_read"
  ON business_hours FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_hours.business_id
        AND b.is_active = true
    )
  );

CREATE POLICY "business_hours_admin_all"
  ON business_hours FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
