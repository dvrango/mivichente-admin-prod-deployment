CREATE TABLE "public"."coupons" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token"       text                     NOT NULL DEFAULT translate(encode(extensions.gen_random_bytes(18), 'base64'::text), '+/'::text, '-_'::text),
  "business_id" uuid                     NOT NULL,
  "source"      text                     NOT NULL,
  "benefit"     text                     NOT NULL,
  "expires_at"  timestamp with time zone NOT NULL,
  "device_id"   text,
  "redeemed_at" timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "coupons_benefit_length" CHECK (((char_length(benefit) >= 1) AND (char_length(benefit) <= 40))),
  CONSTRAINT "coupons_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "coupons_device_id_length" CHECK (((device_id IS NULL) OR ((char_length(device_id) >= 1) AND (char_length(device_id) <= 100)))),
  CONSTRAINT "coupons_feedback_needs_device" CHECK (((source <> 'feedback'::text) OR (device_id IS NOT NULL))),
  CONSTRAINT "coupons_pkey" PRIMARY KEY (id),
  CONSTRAINT "coupons_redeemed_after_created" CHECK (((redeemed_at IS NULL) OR (redeemed_at >= created_at))),
  CONSTRAINT "coupons_source_check" CHECK ((source = 'feedback'::text)),
  CONSTRAINT "coupons_token_key" UNIQUE (token)
);

ALTER TABLE "public"."coupons"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX coupons_business_created_idx ON public.coupons USING btree (business_id, created_at DESC);

CREATE UNIQUE INDEX coupons_business_device_source_key ON public.coupons USING btree (business_id, device_id, source);

CREATE POLICY "admin reads coupons" ON "public"."coupons"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."coupons" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."coupons" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."coupons"."benefit" IS 'Copia del beneficio del negocio al crearse ("10%"). No se vuelve a leer de businesses.';

COMMENT ON COLUMN "public"."coupons"."device_id" IS 'device_id de la landing (localStorage) que lo generó. Sostiene la regla de uno por celular; se acepta que borrar el navegador la salta.';

COMMENT ON COLUMN "public"."coupons"."expires_at" IS 'Instante en que deja de valer (exclusivo): inicio del día siguiente al último día válido, en hora de Durango. Se calcula al crearse y no cambia.';

COMMENT ON COLUMN "public"."coupons"."redeemed_at" IS 'Cuándo se usó. Null = sin usar. Se marca una sola vez, vía redeem_coupon.';

COMMENT ON COLUMN "public"."coupons"."source" IS 'De dónde salió el cupón: feedback (opinión). Cupón por lote, referido o embajador se agregan al check cuando existan.';

COMMENT ON COLUMN "public"."coupons"."token" IS 'Secreto del link del descuento. Quien lo tiene puede ver y usar el cupón; sin él no hay forma de encontrarlo.';

COMMENT ON TABLE "public"."coupons" IS 'Descuento canjeable, genérico. Hoy solo nace de una opinión (source = feedback). Anon no tiene grants: lo lee y lo usa por su token vía get_coupon / redeem_coupon. Solo el admin lee la tabla (el token es secreto al portador).';
