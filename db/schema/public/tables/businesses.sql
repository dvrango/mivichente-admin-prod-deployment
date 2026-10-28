CREATE TABLE "public"."businesses" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                    text                     NOT NULL,
  "category_id"             uuid,
  "phone"                   text                     NOT NULL,
  "address"                 text,
  "schedule"                text,
  "photo_url"               text,
  "is_active"               boolean                  NOT NULL DEFAULT false,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "aliases"                 text[]                   NOT NULL DEFAULT '{}'::text[],
  "phone_is_whatsapp"       boolean                  NOT NULL DEFAULT false,
  "maps_url"                text,
  "is_verified"             boolean                  NOT NULL DEFAULT false,
  "verified_at"             timestamp with time zone,
  "data_source"             text                     NOT NULL DEFAULT 'scraping'::text,
  "municipio"               text                     NOT NULL DEFAULT 'Vicente Guerrero'::text,
  "colonia"                 text,
  "description"             text,
  "facebook_url"            text,
  "instagram_url"           text,
  "offerings"               text[]                   NOT NULL DEFAULT '{}'::text[],
  "is_featured"             boolean                  NOT NULL DEFAULT false,
  "created_by"              uuid,
  "updated_by"              uuid,
  "slug"                    text                     NOT NULL DEFAULT ''::text,
  "has_delivery"            boolean                  NOT NULL DEFAULT false,
  "services_label"          text,
  "latitude"                double precision,
  "longitude"               double precision,
  "location_accuracy_m"     double precision,
  "whatsapp_phone"          text,
  "accepts_orders"          boolean                  NOT NULL DEFAULT false,
  "delivery_fee"            numeric(10,2),
  "promo_active"            boolean                  NOT NULL DEFAULT false,
  "promo_title"             text,
  "promo_body"              text,
  "promo_ends_at"           date,
  "promo_updated_at"        timestamp with time zone,
  "feedback_reward_active"  boolean                  NOT NULL DEFAULT false,
  "feedback_reward_benefit" text,
  "feedback_reward_days"    integer                  NOT NULL DEFAULT 30,
  CONSTRAINT "businesses_data_source_check" CHECK ((data_source = ANY (ARRAY['scraping'::text, 'self_registered'::text, 'admin'::text]))),
  CONSTRAINT "businesses_delivery_fee_valid" CHECK (((delivery_fee IS NULL) OR ((delivery_fee >= (0)::numeric) AND (delivery_fee <= 99999999.99)))),
  CONSTRAINT "businesses_feedback_reward_active_needs_benefit" CHECK (((NOT feedback_reward_active) OR (NULLIF(btrim(feedback_reward_benefit), ''::text) IS NOT NULL))),
  CONSTRAINT "businesses_feedback_reward_benefit_length"
    CHECK (((feedback_reward_benefit IS NULL) OR ((char_length(feedback_reward_benefit) >= 1) AND (char_length(feedback_reward_benefit) <= 40)))),
  CONSTRAINT "businesses_feedback_reward_days_range" CHECK (((feedback_reward_days >= 1) AND (feedback_reward_days <= 365))),
  CONSTRAINT "businesses_latitude_range" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)))),
  CONSTRAINT "businesses_longitude_range" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
  CONSTRAINT "businesses_pkey" PRIMARY KEY (id),
  CONSTRAINT "businesses_promo_active_needs_title" CHECK (((NOT promo_active) OR (NULLIF(btrim(promo_title), ''::text) IS NOT NULL))),
  CONSTRAINT "businesses_promo_body_length" CHECK (((promo_body IS NULL) OR (char_length(promo_body) <= 2000))),
  CONSTRAINT "businesses_promo_title_length" CHECK (((promo_title IS NULL) OR ((char_length(promo_title) >= 1) AND (char_length(promo_title) <= 80)))),
  CONSTRAINT "businesses_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
  CONSTRAINT "businesses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "businesses_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."businesses"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX businesses_category_id_idx ON public.businesses USING btree (category_id);

CREATE INDEX businesses_coords_idx ON public.businesses USING btree (latitude, longitude)
  WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));

CREATE INDEX businesses_is_active_idx ON public.businesses USING btree (is_active);

CREATE INDEX businesses_municipio_idx ON public.businesses USING btree (municipio);

CREATE INDEX businesses_offerings_gin ON public.businesses USING gin (offerings);

CREATE UNIQUE INDEX businesses_slug_key ON public.businesses USING btree (slug);

CREATE TRIGGER businesses_accepts_orders_admin_only
  BEFORE INSERT OR UPDATE OF accepts_orders ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_accepts_orders_admin();

CREATE TRIGGER businesses_feedback_reward_admin_only
  BEFORE INSERT OR UPDATE OF feedback_reward_active, feedback_reward_benefit, feedback_reward_days ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_feedback_reward_admin();

CREATE TRIGGER businesses_record_old_slug_trigger
  AFTER UPDATE OF slug ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.businesses_record_old_slug();

CREATE TRIGGER businesses_set_services_label
  BEFORE INSERT OR UPDATE OF category_id, services_label ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_services_label();

CREATE TRIGGER businesses_set_slug_trigger
  BEFORE INSERT OR UPDATE OF slug, name ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.businesses_set_slug();

CREATE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER businesses_stamp_promo
  BEFORE INSERT OR UPDATE OF promo_title, promo_body, promo_ends_at, promo_updated_at ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.businesses_stamp_promo();

CREATE POLICY "businesses_delete" ON "public"."businesses"
  FOR DELETE
  TO "authenticated"
  USING (public.is_admin());

CREATE POLICY "businesses_insert" ON "public"."businesses"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.is_admin() OR (municipio = public.user_municipio())));

CREATE POLICY "businesses_public_read" ON "public"."businesses"
  FOR SELECT
  TO "anon"
  USING ((is_active = true));

CREATE POLICY "businesses_select" ON "public"."businesses"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "businesses_update" ON "public"."businesses"
  FOR UPDATE
  TO "authenticated"
  USING ((public.is_admin() OR (municipio = public.user_municipio())))
  WITH CHECK ((public.is_admin() OR (municipio = public.user_municipio())));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."businesses" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."businesses" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."businesses" TO "postgres", "service_role";

ALTER TABLE "public"."businesses"
  ADD COLUMN "name_normalized" text GENERATED ALWAYS AS (lower(public.immutable_unaccent(name))) STORED;

CREATE INDEX businesses_name_normalized_idx ON public.businesses USING btree (name_normalized);

COMMENT ON COLUMN "public"."businesses"."accepts_orders" IS 'True únicamente cuando el negocio aceptó recibir pedidos desde Vichente. Independiente de la categoría y de has_delivery.';

COMMENT ON COLUMN "public"."businesses"."delivery_fee" IS 'MXN por entrega aceptada: null = por confirmar, 0 = gratis, positivo = costo fijo. Ignorado mientras has_delivery sea false. Conserva la RLS de businesses.';

COMMENT ON COLUMN "public"."businesses"."feedback_reward_active" IS 'Interruptor de "opiniones con descuento". Apagado (o el negocio inactivo), la función submit_business_feedback rechaza opiniones. Solo lo cambia un admin (trigger).';

COMMENT ON COLUMN "public"."businesses"."feedback_reward_benefit" IS 'Qué da el descuento, en texto corto ("10%"). Cada cupón guarda su propia copia al crearse. Solo lo cambia un admin (trigger).';

COMMENT ON COLUMN "public"."businesses"."feedback_reward_days" IS 'Días de vigencia del descuento que se genera al dejar una opinión. El cupón vale hasta el final del día N en hora de Durango. Solo lo cambia un admin (trigger).';

COMMENT ON COLUMN "public"."businesses"."promo_active" IS 'Interruptor de la promoción. Apagarla no borra el texto. Vigente = promo_active y (promo_ends_at null o hoy en Durango <= promo_ends_at); lo evalúa el cliente.';

COMMENT ON COLUMN "public"."businesses"."promo_body" IS 'Detalles y términos. Bloques separados por renglón en blanco; en un bloque de varios renglones el primero es subtítulo; renglones que empiezan con "-" o "•" son viñetas.';

COMMENT ON COLUMN "public"."businesses"."promo_ends_at" IS 'Último día válido, inclusivo, en hora de Durango. Null = sin fecha de fin.';

COMMENT ON COLUMN "public"."businesses"."promo_title" IS 'Titular de la promoción, el que se ve en la tarjeta de la ficha. Máximo 80 caracteres.';

COMMENT ON COLUMN "public"."businesses"."promo_updated_at" IS 'Cuándo cambió el contenido de la promoción. La app lo usa como llave de "ya la vio" para mostrar el modal una vez por promoción y device. Lo sella un trigger.';

COMMENT ON COLUMN "public"."businesses"."whatsapp_phone" IS 'Número de WhatsApp cuando es distinto al de llamadas (businesses.phone). NULL = usar phone si phone_is_whatsapp.';
