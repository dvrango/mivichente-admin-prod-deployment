CREATE TABLE "public"."physical_cards" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token"       text                     NOT NULL DEFAULT translate(encode(extensions.gen_random_bytes(18), 'base64'::text), '+/'::text, '-_'::text),
  "business_id" uuid                     NOT NULL,
  "customer_id" uuid,
  "linked_at"   timestamp with time zone,
  "revoked_at"  timestamp with time zone,
  "created_by"  uuid,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "physical_cards_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "physical_cards_customer_fkey" FOREIGN KEY (customer_id, business_id) REFERENCES public.business_customers(id, business_id) ON DELETE CASCADE,
  CONSTRAINT "physical_cards_linked_consistent" CHECK (((customer_id IS NULL) = (linked_at IS NULL))),
  CONSTRAINT "physical_cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "physical_cards_revoked_after_created" CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
  CONSTRAINT "physical_cards_token_key" UNIQUE (token),
  CONSTRAINT "physical_cards_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."physical_cards"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX physical_cards_business_created_idx ON public.physical_cards USING btree (business_id, created_at);

CREATE UNIQUE INDEX physical_cards_one_active_per_customer ON public.physical_cards USING btree (customer_id)
  WHERE ((customer_id IS NOT NULL) AND (revoked_at IS NULL));

CREATE POLICY "admin reads physical cards" ON "public"."physical_cards"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."physical_cards" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."physical_cards" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."physical_cards"."created_by" IS 'Admin que generó la hoja.';

COMMENT ON COLUMN "public"."physical_cards"."customer_id" IS 'Cliente al que se asoció. Null = sin asociar. Una vez puesto no cambia: reasignar a otro cliente no existe.';

COMMENT ON COLUMN "public"."physical_cards"."revoked_at" IS 'Cuándo dejó de servir: la reemplazó otra física del mismo cliente o se anuló la hoja. Revocada, se comporta como un token que no existe.';

COMMENT ON COLUMN "public"."physical_cards"."token" IS 'Secreto del QR impreso (https://vichente.com/t/{token}). No se imprime como texto y no se puede rotar.';

COMMENT ON TABLE "public"."physical_cards" IS 'Tarjeta física impresa de un cliente en un negocio. Nace ligada al negocio cuando el admin genera la hoja (admin_create_physical_cards) y al cliente cuando él la escanea con su celular (link_physical_card). Sin asociar no se puede sellar. Una sola vigente por cliente: asociar otra revoca la anterior. Solo el admin lee la tabla.';
