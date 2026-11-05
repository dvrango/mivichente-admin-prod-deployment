CREATE TABLE "public"."business_customers" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token"       text                     NOT NULL DEFAULT translate(encode(extensions.gen_random_bytes(18), 'base64'::text), '+/'::text, '-_'::text),
  "business_id" uuid                     NOT NULL,
  "device_id"   text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_customers_device_id_length" CHECK (((char_length(device_id) >= 1) AND (char_length(device_id) <= 100))),
  CONSTRAINT "business_customers_id_business_key" UNIQUE (id, business_id),
  CONSTRAINT "business_customers_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_customers_token_key" UNIQUE (token),
  CONSTRAINT "business_customers_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_customers"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX business_customers_business_device_key ON public.business_customers USING btree (business_id, device_id);

CREATE POLICY "admin reads business customers" ON "public"."business_customers"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."business_customers" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_customers" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_customers"."device_id" IS 'device_id de la landing (localStorage). Sostiene un cliente por celular y negocio; se acepta que borrar el navegador lo salta. NO es secreto: nunca basta para llegar al cliente.';

COMMENT ON COLUMN "public"."business_customers"."token" IS 'Secreto del link y del QR de la tarjeta digital. No cambia nunca, ni al canjear ni al asociar una física.';

COMMENT ON TABLE "public"."business_customers" IS 'El cliente en un negocio, sin cuenta y sin importar la mecánica. Hoy lo usa la tarjeta de sellos; una mecánica nueva se cuelga de aquí. Anon no tiene grants: obtiene y lee su tarjeta por token vía funciones. El dueño llega a él por su token o por el de su tarjeta física (resolve_customer_token). Solo el admin lee la tabla (el token es secreto al portador).';
