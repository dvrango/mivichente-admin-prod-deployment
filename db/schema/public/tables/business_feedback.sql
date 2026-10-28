CREATE TABLE "public"."business_feedback" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_id" uuid                     NOT NULL,
  "coupon_id"   uuid                     NOT NULL,
  "rating"      smallint                 NOT NULL,
  "liked"       text,
  "improve"     text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_feedback_coupon_id_key" UNIQUE (coupon_id),
  CONSTRAINT "business_feedback_improve_length" CHECK (((improve IS NULL) OR ((char_length(improve) >= 1) AND (char_length(improve) <= 1000)))),
  CONSTRAINT "business_feedback_liked_length" CHECK (((liked IS NULL) OR ((char_length(liked) >= 1) AND (char_length(liked) <= 1000)))),
  CONSTRAINT "business_feedback_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_feedback_rating_range" CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT "business_feedback_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "business_feedback_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_feedback"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_feedback_business_created_idx ON public.business_feedback USING btree (business_id, created_at DESC);

CREATE POLICY "staff reads business feedback" ON "public"."business_feedback"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

GRANT SELECT ON TABLE "public"."business_feedback" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_feedback" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_feedback"."improve" IS 'Respuesta opcional a "¿Qué mejorarías?".';

COMMENT ON COLUMN "public"."business_feedback"."liked" IS 'Respuesta opcional a "¿Qué te gustó?".';

COMMENT ON TABLE "public"."business_feedback" IS 'Opinión privada que deja un cliente desde el QR del local. Sin nombre ni teléfono. Solo la lee el staff; anon la crea vía submit_business_feedback y nunca la puede leer. No guarda device_id: ese vive en coupons, que solo lee admin.';
