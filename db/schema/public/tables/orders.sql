CREATE TABLE "public"."orders" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token"               text                     NOT NULL DEFAULT translate(encode(extensions.gen_random_bytes(18), 'base64'::text), '+/'::text, '-_'::text),
  "business_id"         uuid                     NOT NULL,
  "status"              text                     NOT NULL DEFAULT 'pending'::text,
  "mode"                text                     NOT NULL,
  "items"               jsonb                    NOT NULL,
  "subtotal_cents"      integer                  NOT NULL,
  "delivery_fee_cents"  integer,
  "total_cents"         integer                  NOT NULL,
  "customer_name"       text,
  "customer_phone"      text,
  "delivery_lat"        double precision,
  "delivery_lng"        double precision,
  "delivery_directions" text,
  "delivery_references" text,
  "pays_with"           text,
  "notify_status"       text                     NOT NULL DEFAULT 'pending'::text,
  "notify_error"        text,
  "notify_updated_at"   timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "accepted_at"         timestamp with time zone,
  "rejected_at"         timestamp with time zone,
  "preparing_at"        timestamp with time zone,
  "on_the_way_at"       timestamp with time zone,
  "delivered_at"        timestamp with time zone,
  CONSTRAINT "orders_amounts_check"
    CHECK (((subtotal_cents >= 0) AND ((delivery_fee_cents IS NULL) OR (delivery_fee_cents >= 0)) AND (total_cents = (subtotal_cents + COALESCE(delivery_fee_cents, 0))))),
  CONSTRAINT "orders_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "orders_items_check" CHECK (((jsonb_typeof(items) = 'array'::text) AND ((jsonb_array_length(items) >= 1) AND (jsonb_array_length(items) <= 50)))),
  CONSTRAINT "orders_location_pair_check" CHECK (((delivery_lat IS NULL) = (delivery_lng IS NULL))),
  CONSTRAINT "orders_mode_check" CHECK ((mode = ANY (ARRAY['delivery'::text, 'pickup'::text]))),
  CONSTRAINT "orders_notify_error_check" CHECK (((notify_error IS NULL) OR (notify_status = 'failed'::text))),
  CONSTRAINT "orders_notify_status_check" CHECK ((notify_status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text]))),
  CONSTRAINT "orders_pickup_check"
    CHECK (((mode = 'delivery'::text) OR ((delivery_fee_cents = 0) AND (delivery_lat IS NULL) AND (delivery_directions IS NULL) AND (delivery_references IS NULL)))),
  CONSTRAINT "orders_pkey" PRIMARY KEY (id),
  CONSTRAINT "orders_status_check"
    CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'preparing'::text, 'on_the_way'::text, 'delivered'::text, 'withdrawn'::text]))),
  CONSTRAINT "orders_token_key" UNIQUE (token)
);

ALTER TABLE "public"."orders"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX orders_business_created_idx ON public.orders USING btree (business_id, created_at DESC);

CREATE INDEX orders_notice_due_idx ON public.orders USING btree (created_at)
  WHERE ((status = 'pending'::text) AND (notify_status = 'pending'::text));

CREATE TRIGGER orders_guard
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_guard();

CREATE POLICY "admin reads orders" ON "public"."orders"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

GRANT SELECT ON TABLE "public"."orders" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "postgres";

COMMENT ON COLUMN "public"."orders"."accepted_at" IS 'Hora del cambio a ese estado; igual rejected_at, preparing_at, on_the_way_at y delivered_at. Las escribe orders_guard, nadie más.';

COMMENT ON COLUMN "public"."orders"."customer_phone" IS '10 dígitos. Obligatorio al crear (create_order). Nulable para que la retención pueda borrarlo; una vez escrito solo puede pasar a null.';

COMMENT ON COLUMN "public"."orders"."delivery_directions" IS 'Cómo llegar, cuando el cliente no marcó en el mapa. A domicilio se exige esto o delivery_lat/lng.';

COMMENT ON COLUMN "public"."orders"."delivery_fee_cents" IS 'Envío al crearse. null = por confirmar con el negocio (businesses.delivery_fee null), 0 = gratis o paso por él.';

COMMENT ON COLUMN "public"."orders"."items" IS 'Foto de lo pedido al crearse, con precios del menú vigente en ese momento: [{service_id, name, variant_id, variant_name, options: [{group_id, group_name, option_id, name, price_delta_cents}], quantity, unit_price_cents, line_total_cents, note}]. No cambia aunque cambie el menú.';

COMMENT ON COLUMN "public"."orders"."notify_status" IS 'Aviso al restaurante: pending (nadie lo ha tomado), sending (el servidor lo está mandando), sent (Meta lo aceptó), failed (Meta lo rechazó; el detalle en notify_error). Lo escribe el servidor.';

COMMENT ON COLUMN "public"."orders"."status" IS 'pending → accepted or rejected; accepted → preparing → on_the_way → delivered. withdrawn: the customer changed it during the send window, before the restaurant got the notice (withdraw_order); for the restaurant and the pilot numbers it never existed. rejected, delivered and withdrawn are final.';

COMMENT ON COLUMN "public"."orders"."token" IS 'Secreto con el que el cliente lee su pedido; la app lo guarda en el dispositivo. El id no es secreto: puede ir en registros y en los botones de WhatsApp, y no sirve para leer el pedido.';

COMMENT ON TABLE "public"."orders" IS 'Pedido del flujo con estados (piloto). Anon no tiene grants: crea, lee, retira y confirma su pedido por token vía create_order / get_order / withdraw_order / confirm_order_received. El servidor cambia el estado con set_order_status (service_role) y anota el aviso al restaurante en notify_*. Solo el admin lee la tabla. Un pedido solo nace por create_order: service_role no tiene INSERT. orders_guard impide transiciones inválidas y cambios a lo pedido.';

REVOKE ALL ON TABLE "public"."orders" FROM "service_role";

GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, UPDATE ON TABLE "public"."orders" TO "service_role";
