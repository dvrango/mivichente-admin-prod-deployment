CREATE TABLE "public"."stamp_card_stamps" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "card_id"     uuid                     NOT NULL,
  "customer_id" uuid                     NOT NULL,
  "stamp_day"   date                     NOT NULL,
  "stamped_by"  uuid,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stamp_card_stamps_pkey" PRIMARY KEY (id),
  CONSTRAINT "stamp_card_stamps_stamped_by_fkey" FOREIGN KEY (stamped_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "stamp_card_stamps_card_customer_fkey" FOREIGN KEY (card_id, customer_id) REFERENCES public.stamp_cards(id, customer_id) ON DELETE CASCADE
);

ALTER TABLE "public"."stamp_card_stamps"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX stamp_card_stamps_card_idx ON public.stamp_card_stamps USING btree (card_id);

CREATE UNIQUE INDEX stamp_card_stamps_customer_day_key ON public.stamp_card_stamps USING btree (customer_id, stamp_day);

CREATE POLICY "admin reads stamp card stamps" ON "public"."stamp_card_stamps"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."stamp_card_stamps" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stamp_card_stamps" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."stamp_card_stamps"."customer_id" IS 'Repetido de la vuelta para que «uno por día» valga por cliente y no por vuelta. Como el cliente es el mismo con la tarjeta digital o con la física, el límite cuenta igual por las dos.';

COMMENT ON COLUMN "public"."stamp_card_stamps"."stamped_by" IS 'Cuenta del dueño que dio el sello. Rastro para revisar abusos (sellos regalados a costa del negocio).';

COMMENT ON TABLE "public"."stamp_card_stamps" IS 'Un sello en una vuelta de la tarjeta. Uno por cliente y día (hora de Durango), sostenido por índice único. Solo lo crea owner_add_stamp.';
