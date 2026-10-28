CREATE TABLE "public"."business_service_options" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "group_id"    uuid                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "price_delta" numeric(10,2)            NOT NULL DEFAULT 0,
  "order_index" integer                  NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"  uuid,
  "updated_by"  uuid,
  CONSTRAINT "business_service_options_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.business_service_option_groups(id) ON DELETE CASCADE,
  CONSTRAINT "business_service_options_name_no_vacio" CHECK ((length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT "business_service_options_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_service_options_price_delta_no_negativo" CHECK ((price_delta >= (0)::numeric)),
  CONSTRAINT "business_service_options_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_service_options_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "business_service_options_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_service_options"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_service_options_business_id_idx ON public.business_service_options USING btree (business_id);

CREATE INDEX business_service_options_group_id_idx ON public.business_service_options USING btree (group_id, order_index);

CREATE TRIGGER business_service_options_set_business_id
  BEFORE INSERT OR UPDATE OF group_id, business_id ON public.business_service_options
  FOR EACH ROW
  EXECUTE FUNCTION public.set_option_business_id();

CREATE TRIGGER business_service_options_set_updated_at
  BEFORE UPDATE ON public.business_service_options
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "business_service_options_delete" ON "public"."business_service_options"
  FOR DELETE
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_service_options_insert" ON "public"."business_service_options"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.can_edit_business(business_id));

CREATE POLICY "business_service_options_public_read" ON "public"."business_service_options"
  FOR SELECT
  TO "anon"
  USING ((EXISTS ( SELECT 1
   FROM ((public.business_service_option_groups g
     JOIN public.business_services s ON ((s.id = g.service_id)))
     JOIN public.businesses b ON ((b.id = s.business_id)))
  WHERE ((g.id = business_service_options.group_id) AND (s.is_published = true) AND (b.is_active = true)))));

CREATE POLICY "business_service_options_select_auth" ON "public"."business_service_options"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "business_service_options_update" ON "public"."business_service_options"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_edit_business(business_id))
  WITH CHECK (public.can_edit_business(business_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_service_options" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_service_options" TO "postgres", "service_role";

COMMENT ON TABLE "public"."business_service_options" IS 'Cada opción elegible de un grupo. price_delta es lo que SUMA al precio de la línea (0 = sin costo); nunca lo fija ni lo baja.';
