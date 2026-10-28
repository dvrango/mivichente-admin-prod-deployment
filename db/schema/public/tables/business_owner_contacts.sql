CREATE TABLE "public"."business_owner_contacts" (
  "business_id"        uuid                     NOT NULL,
  "owner"              text,
  "owner_phone"        text,
  "owner_contact_note" text,
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by"         uuid,
  CONSTRAINT "business_owner_contacts_pkey" PRIMARY KEY (business_id),
  CONSTRAINT "business_owner_contacts_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_owner_contacts_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_owner_contacts"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER business_owner_contacts_stamp
  BEFORE INSERT OR UPDATE ON public.business_owner_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.business_owner_contacts_stamp();

CREATE POLICY "business_owner_contacts_delete" ON "public"."business_owner_contacts"
  FOR DELETE
  TO "authenticated"
  USING (public.is_admin());

CREATE POLICY "business_owner_contacts_insert" ON "public"."business_owner_contacts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.can_edit_business(business_id));

CREATE POLICY "business_owner_contacts_select" ON "public"."business_owner_contacts"
  FOR SELECT
  TO "authenticated"
  USING (public.can_edit_business(business_id));

CREATE POLICY "business_owner_contacts_update" ON "public"."business_owner_contacts"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_edit_business(business_id))
  WITH CHECK (public.can_edit_business(business_id));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_owner_contacts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_owner_contacts" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_owner_contacts"."owner" IS 'Nombre del dueño del negocio. Uso interno (campaña de campo), no se muestra en la app.';

COMMENT ON COLUMN "public"."business_owner_contacts"."owner_contact_note" IS 'Quién es el contacto real ("hija del dueño, lleva el FB"). Texto libre corto.';

COMMENT ON COLUMN "public"."business_owner_contacts"."owner_phone" IS 'Teléfono de contacto del dueño/encargado, 10 dígitos sin formato. Uso interno.';

COMMENT ON TABLE "public"."business_owner_contacts" IS 'Contacto interno del dueño de cada negocio (campaña de campo). Solo staff: nunca se expone a anon.';
