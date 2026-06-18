-- Grant table privileges to match businesses pattern
GRANT SELECT ON business_hours TO anon;
GRANT ALL ON business_hours TO authenticated;
