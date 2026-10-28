CREATE TABLE "public"."business_reports" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_id" uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "note"        text,
  "device_id"   text,
  CONSTRAINT "business_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_reports_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_reports"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."business_reports"
  ADD COLUMN "reason" public.business_report_reason NOT NULL;

CREATE POLICY "anyone can report" ON "public"."business_reports"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "business_reports_delete" ON "public"."business_reports"
  FOR DELETE
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_reports_select_auth" ON "public"."business_reports"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_reports" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_reports" TO "postgres", "service_role";
