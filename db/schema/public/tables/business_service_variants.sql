CREATE TABLE "public"."business_service_variants" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "service_id"  uuid                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "price"       numeric(10,2)            NOT NULL,
  "order_index" integer                  NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"  uuid,
  "updated_by"  uuid,
  CONSTRAINT "business_service_variants_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_service_variants_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.business_services(id) ON DELETE CASCADE,
  CONSTRAINT "business_service_variants_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_service_variants_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "business_service_variants_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_service_variants"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_service_variants_business_id_idx ON public.business_service_variants USING btree (business_id);

CREATE INDEX business_service_variants_service_id_idx ON public.business_service_variants USING btree (service_id, order_index);

CREATE TRIGGER business_service_variants_set_business_id
  BEFORE INSERT OR UPDATE OF service_id, business_id ON public.business_service_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_variant_business_id();

CREATE TRIGGER business_service_variants_set_updated_at
  BEFORE UPDATE ON public.business_service_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "business_service_variants_delete" ON "public"."business_service_variants"
  FOR DELETE
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_service_variants_insert" ON "public"."business_service_variants"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.can_edit_business(business_id));

CREATE POLICY "business_service_variants_public_read" ON "public"."business_service_variants"
  FOR SELECT
  TO "anon"
  USING ((EXISTS ( SELECT 1
   FROM (public.business_services s
     JOIN public.businesses b ON ((b.id = s.business_id)))
  WHERE ((s.id = business_service_variants.service_id) AND (s.is_published = true) AND (b.is_active = true)))));

CREATE POLICY "business_service_variants_select_auth" ON "public"."business_service_variants"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "business_service_variants_update" ON "public"."business_service_variants"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_edit_business(business_id))
  WITH CHECK (public.can_edit_business(business_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_service_variants" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."business_service_variants" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_service_variants" TO "postgres", "service_role";

COMMENT ON TABLE "public"."business_service_variants" IS 'Tamaños o presentaciones de un platillo, cada uno con su precio. Cuando un platillo tiene variantes, business_services.price pasa a leerse como "desde" (el menor de ellas).';
