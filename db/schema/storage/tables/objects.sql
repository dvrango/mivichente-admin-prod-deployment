CREATE POLICY "Allow authenticated uploads" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'marketplace_images'::text));

CREATE POLICY "Allow individual user delete access" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'marketplace_images'::text) AND (OWNER = auth.uid())));

CREATE POLICY "Allow individual user update access" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'marketplace_images'::text) AND (OWNER = auth.uid())));

CREATE POLICY "Allow public read access" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'marketplace_images'::text));

CREATE POLICY "business-photos public read" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'business-photos'::text));

CREATE POLICY "business-photos staff delete" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'business-photos'::text) AND public.can_write_business_photo(name)));

CREATE POLICY "business-photos staff insert" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'business-photos'::text) AND public.can_write_business_photo(name)));

CREATE POLICY "business-photos staff update" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'business-photos'::text) AND public.can_write_business_photo(name)))
  WITH CHECK (((bucket_id = 'business-photos'::text) AND public.can_write_business_photo(name)));

CREATE POLICY "registration-photos admin delete" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'registration-photos'::text) AND public.is_admin()));

CREATE POLICY "registration-photos admin read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'registration-photos'::text) AND public.is_admin()));
