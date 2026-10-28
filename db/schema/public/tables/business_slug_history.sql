CREATE TABLE "public"."business_slug_history" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_id" uuid                     NOT NULL,
  "slug"        text                     NOT NULL,
  "replaced_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_slug_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_slug_history_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_slug_history"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_slug_history_business_idx ON public.business_slug_history USING btree (business_id);

CREATE UNIQUE INDEX business_slug_history_slug_key ON public.business_slug_history USING btree (slug);

CREATE POLICY "business_slug_history_public_read" ON "public"."business_slug_history"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_slug_history" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_slug_history" TO "postgres", "service_role";
