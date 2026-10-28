CREATE TABLE "public"."business_service_option_groups" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "service_id"  uuid                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "min_select"  integer                  NOT NULL DEFAULT 1,
  "max_select"  integer,
  "order_index" integer                  NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"  uuid,
  "updated_by"  uuid,
  CONSTRAINT "business_service_option_groups_name_no_vacio" CHECK ((length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT "business_service_option_groups_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_service_option_groups_select_range" CHECK (((min_select >= 0) AND ((max_select IS NULL) OR (max_select >= GREATEST(min_select, 1))))),
  CONSTRAINT "business_service_option_groups_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.business_services(id) ON DELETE CASCADE,
  CONSTRAINT "business_service_option_groups_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_service_option_groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "business_service_option_groups_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_service_option_groups"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_service_option_groups_business_id_idx ON public.business_service_option_groups USING btree (business_id);

CREATE INDEX business_service_option_groups_service_id_idx ON public.business_service_option_groups USING btree (service_id, order_index);

CREATE TRIGGER business_service_option_groups_reject_size
  BEFORE INSERT OR UPDATE OF name ON public.business_service_option_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_size_option_group();

CREATE TRIGGER business_service_option_groups_set_business_id
  BEFORE INSERT OR UPDATE OF service_id, business_id ON public.business_service_option_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_option_group_business_id();

CREATE TRIGGER business_service_option_groups_set_updated_at
  BEFORE UPDATE ON public.business_service_option_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "business_service_option_groups_delete" ON "public"."business_service_option_groups"
  FOR DELETE
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_service_option_groups_insert" ON "public"."business_service_option_groups"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.can_edit_business(business_id));

CREATE POLICY "business_service_option_groups_public_read" ON "public"."business_service_option_groups"
  FOR SELECT
  TO "anon"
  USING ((EXISTS ( SELECT 1
   FROM (public.business_services s
     JOIN public.businesses b ON ((b.id = s.business_id)))
  WHERE ((s.id = business_service_option_groups.service_id) AND (s.is_published = true) AND (b.is_active = true)))));

CREATE POLICY "business_service_option_groups_select_auth" ON "public"."business_service_option_groups"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "business_service_option_groups_update" ON "public"."business_service_option_groups"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_edit_business(business_id))
  WITH CHECK (public.can_edit_business(business_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_service_option_groups" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_service_option_groups" TO "postgres", "service_role";

COMMENT ON TABLE "public"."business_service_option_groups" IS 'Lo que el cliente elige de un platillo además del tamaño (sabor, leche, extras). El grupo SUMA al precio; el tamaño, que lo FIJA, vive en business_service_variants. Obligatorio = min_select >= 1; max_select null = sin tope.';
