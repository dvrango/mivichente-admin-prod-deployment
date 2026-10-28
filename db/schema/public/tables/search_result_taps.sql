CREATE TABLE "public"."search_result_taps" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "device_id"   text                     NOT NULL,
  "query"       text                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "search_result_taps_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "search_result_taps_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."search_result_taps"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can log a search result tap" ON "public"."search_result_taps"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."search_result_taps" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."search_result_taps" TO "postgres", "service_role";
