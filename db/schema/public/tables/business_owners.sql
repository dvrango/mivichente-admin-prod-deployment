CREATE TABLE "public"."business_owners" (
  "profile_id"  uuid                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_owners_pkey" PRIMARY KEY (profile_id, business_id),
  CONSTRAINT "business_owners_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_owners_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_owners"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_owners_business_idx ON public.business_owners USING btree (business_id);

CREATE POLICY "admin reads business owners" ON "public"."business_owners"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."business_owners" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_owners" TO "postgres", "service_role";

COMMENT ON TABLE "public"."business_owners" IS 'Negocios que ve cada cuenta con rol owner. Un dueño puede tener varios. La mantiene el usuario desde SQL; ninguna cuenta de la aplicación escribe aquí.';
