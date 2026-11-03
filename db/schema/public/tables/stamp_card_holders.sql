CREATE TABLE "public"."stamp_card_holders" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token"       text                     NOT NULL DEFAULT translate(encode(extensions.gen_random_bytes(18), 'base64'::text), '+/'::text, '-_'::text),
  "business_id" uuid                     NOT NULL,
  "device_id"   text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stamp_card_holders_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "stamp_card_holders_device_id_length" CHECK (((char_length(device_id) >= 1) AND (char_length(device_id) <= 100))),
  CONSTRAINT "stamp_card_holders_pkey" PRIMARY KEY (id),
  CONSTRAINT "stamp_card_holders_token_key" UNIQUE (token)
);

ALTER TABLE "public"."stamp_card_holders"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX stamp_card_holders_business_device_key ON public.stamp_card_holders USING btree (business_id, device_id);

CREATE POLICY "admin reads stamp card holders" ON "public"."stamp_card_holders"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."stamp_card_holders" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stamp_card_holders" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."stamp_card_holders"."device_id" IS 'device_id de la landing (localStorage). Sostiene una tarjeta por celular y negocio; se acepta que borrar el navegador la salta.';

COMMENT ON COLUMN "public"."stamp_card_holders"."token" IS 'Secreto del link y del QR de la tarjeta. No cambia al canjear: cada vuelta es una fila de stamp_cards.';

COMMENT ON TABLE "public"."stamp_card_holders" IS 'Cliente de la tarjeta de sellos en un negocio, sin cuenta. Anon no tiene grants: obtiene su tarjeta y la lee por su token vía get_or_create_stamp_card / get_stamp_card. El dueño la ve y la sella por token vía owner_*. Solo el admin lee la tabla (el token es secreto al portador).';
