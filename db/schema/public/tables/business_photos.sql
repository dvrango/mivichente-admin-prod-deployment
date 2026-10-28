CREATE TABLE "public"."business_photos" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_id" uuid                     NOT NULL,
  "url"         text                     NOT NULL,
  "caption"     text,
  "order_index" integer                  NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "kind"        text                     NOT NULL DEFAULT 'otro'::text,
  CONSTRAINT "business_photos_kind_check" CHECK ((kind = ANY (ARRAY['fachada'::text, 'interior'::text, 'producto'::text, 'menu'::text, 'equipo'::text, 'otro'::text]))),
  CONSTRAINT "business_photos_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_photos_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_photos"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_photos_business_id_idx ON public.business_photos USING btree (business_id, order_index);

CREATE INDEX business_photos_menu_idx ON public.business_photos USING btree (business_id)
  WHERE (kind = 'menu'::text);

CREATE POLICY "business_photos_delete" ON "public"."business_photos"
  FOR DELETE
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_photos_insert" ON "public"."business_photos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.can_edit_business(business_id));

CREATE POLICY "business_photos_public_read" ON "public"."business_photos"
  FOR SELECT
  TO "anon"
  USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_photos.business_id) AND (b.is_active = true)))));

CREATE POLICY "business_photos_select_auth" ON "public"."business_photos"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "business_photos_update" ON "public"."business_photos"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_edit_business(business_id))
  WITH CHECK (public.can_edit_business(business_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_photos" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."business_photos" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_photos" TO "postgres", "service_role";
