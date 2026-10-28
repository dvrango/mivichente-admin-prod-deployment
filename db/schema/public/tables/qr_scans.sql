CREATE TABLE "public"."qr_scans" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "src"          text                     NOT NULL,
  "user_agent"   text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "business_id"  uuid,
  "channel"      text                     NOT NULL,
  "slug_at_scan" text,
  CONSTRAINT "qr_scans_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL,
  CONSTRAINT "qr_scans_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."qr_scans"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX qr_scans_business_created_idx ON public.qr_scans USING btree (business_id, created_at DESC)
  WHERE (business_id IS NOT NULL);

CREATE INDEX qr_scans_channel_created_idx ON public.qr_scans USING btree (channel, created_at DESC);

CREATE TRIGGER qr_scans_set_channel_trigger
  BEFORE INSERT OR UPDATE OF src, channel, user_agent ON public.qr_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_scans_set_channel();

CREATE POLICY "anyone can log a qr scan" ON "public"."qr_scans"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."qr_scans" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."qr_scans" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."qr_scans"."business_id" IS 'Negocio dueño del QR/enlace escaneado. Lo deriva el servidor de la ruta, no del parámetro impreso. Null en canales que no son por negocio (los stickers de la campaña de julio).';

COMMENT ON COLUMN "public"."qr_scans"."channel" IS 'Canal por el que llegó el scan: menu-qr, opinion-qr, sticker, share, post-ig, post-fb, landing, bot, otro. Lo pone siempre el trigger (ignora el del cliente): bot si el user-agent es de un crawler; si no, lo deriva de `src`.';

COMMENT ON COLUMN "public"."qr_scans"."slug_at_scan" IS 'Slug tal como venía impreso al momento del scan. El negocio puede renombrarse; el papel pegado en la mesa no. Guardarlo deja saber qué QR físico se usó.';

COMMENT ON COLUMN "public"."qr_scans"."src" IS 'Valor crudo del parámetro ?src=, tal cual llegó. Se conserva para no romper lo que ya inserta (stickers, ?src=share) y como evidencia del detalle (número de sticker, nombre del post). Para agrupar, usar `channel`.';
