CREATE TABLE "public"."business_services" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_id"     uuid                     NOT NULL,
  "name"            text                     NOT NULL,
  "price"           numeric(10,2),
  "description"     text,
  "order_index"     integer                  NOT NULL DEFAULT 0,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "image_url"       text,
  "section"         text,
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "is_published"    boolean                  NOT NULL DEFAULT true,
  "show_in_profile" boolean                  NOT NULL DEFAULT true,
  "created_by"      uuid,
  "updated_by"      uuid,
  CONSTRAINT "business_services_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_services_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_services_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "business_services_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_services"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_services_business_id_idx ON public.business_services USING btree (business_id, order_index);

CREATE INDEX business_services_section_idx ON public.business_services USING btree (business_id, section, order_index);

CREATE TRIGGER business_services_set_updated_at
  BEFORE UPDATE ON public.business_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "business_services_delete" ON "public"."business_services"
  FOR DELETE
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_services_insert" ON "public"."business_services"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.can_edit_business(business_id));

CREATE POLICY "business_services_public_read" ON "public"."business_services"
  FOR SELECT
  TO "anon"
  USING (((is_published = true) AND (EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_services.business_id) AND (b.is_active = true))))));

CREATE POLICY "business_services_select_auth" ON "public"."business_services"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "business_services_update" ON "public"."business_services"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_edit_business(business_id))
  WITH CHECK (public.can_edit_business(business_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_services" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."business_services" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_services" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_services"."created_by" IS 'Perfil que capturó el ítem. Null en los ítems anteriores a 2026-09 (no hay backfill: no se sabe quién los cargó).';

COMMENT ON COLUMN "public"."business_services"."is_published" IS 'Si es false, el servicio/platillo no se muestra en la app aunque el negocio esté activo. Control manual desde el admin para ocultar mientras se arma el menú.';

COMMENT ON COLUMN "public"."business_services"."section" IS 'Sección del menú a la que pertenece el platillo (ej. "Elotes", "Bebidas"). Null = el negocio no tiene secciones y su menú se muestra como lista plana.';

COMMENT ON COLUMN "public"."business_services"."show_in_profile" IS 'Si es false, el ítem no sale en el perfil del negocio (Flutter) aunque esté publicado y sí aparezca en el menú de mesa. El menú de mesa nunca filtra por esta columna.';

COMMENT ON COLUMN "public"."business_services"."updated_at" IS 'Última edición del platillo. Alimenta la fecha visible al pie del menú de mesa.';

COMMENT ON COLUMN "public"."business_services"."updated_by" IS 'Perfil que hizo la última edición del ítem. Null si nunca se editó desde que existe la columna.';
