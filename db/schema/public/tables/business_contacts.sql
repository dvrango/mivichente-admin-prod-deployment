CREATE TABLE "public"."business_contacts" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "device_id"   text                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "channel"     text                     NOT NULL,
  "source"      text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_contacts_channel_check" CHECK ((channel = ANY (ARRAY['call'::text, 'whatsapp'::text, 'maps'::text]))),
  CONSTRAINT "business_contacts_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_contacts_source_check" CHECK ((source = ANY (ARRAY['app'::text, 'landing'::text]))),
  CONSTRAINT "business_contacts_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_contacts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_contacts_business_created_idx ON public.business_contacts USING btree (business_id, created_at DESC);

CREATE INDEX business_contacts_channel_created_idx ON public.business_contacts USING btree (channel, created_at DESC);

CREATE POLICY "anyone can log a contact" ON "public"."business_contacts"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_contacts" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_contacts" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_contacts"."channel" IS 'Por qué medio se contactó: call, whatsapp o maps. Se registra la intención (tap del botón), no si la llamada/el mensaje se completó.';

COMMENT ON COLUMN "public"."business_contacts"."source" IS 'app = cliente Flutter (nativo Android + web app en app.vichente.com). landing = vichente.com (Next.js), implementación de contacto independiente.';
