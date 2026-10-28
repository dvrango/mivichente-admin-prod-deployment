CREATE TABLE "public"."business_categories" (
  "business_id" uuid                     NOT NULL,
  "category_id" uuid                     NOT NULL,
  "is_primary"  boolean                  NOT NULL DEFAULT false,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_categories_pkey" PRIMARY KEY (business_id, category_id),
  CONSTRAINT "business_categories_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_categories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_categories"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_categories_category_id_idx ON public.business_categories USING btree (category_id);

CREATE UNIQUE INDEX one_primary_per_business ON public.business_categories USING btree (business_id)
  WHERE is_primary;

CREATE POLICY "business_categories_delete" ON "public"."business_categories"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_categories.business_id) AND (public.is_admin() OR (b.municipio = public.user_municipio()))))));

CREATE POLICY "business_categories_insert" ON "public"."business_categories"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_categories.business_id) AND (public.is_admin() OR (b.municipio = public.user_municipio()))))));

CREATE POLICY "business_categories_public_read" ON "public"."business_categories"
  FOR SELECT
  TO "anon"
  USING (true);

CREATE POLICY "business_categories_select_auth" ON "public"."business_categories"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_categories" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_categories" TO "postgres", "service_role";
