CREATE TABLE "public"."stamp_cards" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"     uuid                     NOT NULL,
  "stamps_required" integer                  NOT NULL,
  "reward"          text                     NOT NULL,
  "redeemed_at"     timestamp with time zone,
  "redeemed_by"     uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stamp_cards_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.business_customers(id) ON DELETE CASCADE,
  CONSTRAINT "stamp_cards_id_customer_key" UNIQUE (id, customer_id),
  CONSTRAINT "stamp_cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "stamp_cards_redeemed_after_created" CHECK (((redeemed_at IS NULL) OR (redeemed_at >= created_at))),
  CONSTRAINT "stamp_cards_redeemed_by_fkey" FOREIGN KEY (redeemed_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "stamp_cards_redeemed_by_needs_redeemed_at" CHECK (((redeemed_by IS NULL) OR (redeemed_at IS NOT NULL))),
  CONSTRAINT "stamp_cards_reward_length" CHECK (((char_length(reward) >= 1) AND (char_length(reward) <= 40))),
  CONSTRAINT "stamp_cards_stamps_required_range" CHECK (((stamps_required >= 2) AND (stamps_required <= 20)))
);

ALTER TABLE "public"."stamp_cards"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX stamp_cards_customer_created_idx ON public.stamp_cards USING btree (customer_id, created_at DESC);

CREATE UNIQUE INDEX stamp_cards_one_open_per_customer ON public.stamp_cards USING btree (customer_id)
  WHERE (redeemed_at IS NULL);

CREATE POLICY "admin reads stamp cards" ON "public"."stamp_cards"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."stamp_cards" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stamp_cards" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."stamp_cards"."redeemed_at" IS 'Cuándo el dueño entregó el premio. Null = vuelta abierta. Se marca una sola vez, vía owner_redeem_stamp_card.';

COMMENT ON COLUMN "public"."stamp_cards"."redeemed_by" IS 'Cuenta que canjeó el premio.';

COMMENT ON COLUMN "public"."stamp_cards"."reward" IS 'Copia de businesses.stamp_card_reward al abrirse la vuelta.';

COMMENT ON COLUMN "public"."stamp_cards"."stamps_required" IS 'Copia de businesses.stamp_card_stamps_required al abrirse la vuelta.';

COMMENT ON TABLE "public"."stamp_cards" IS 'Una vuelta de la tarjeta de sellos. Se llena con stamps_required sellos y se canjea una sola vez (redeemed_at). Al canjear, si el programa sigue prendido, se abre la vuelta siguiente con la configuración vigente.';
