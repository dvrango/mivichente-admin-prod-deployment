CREATE TABLE "public"."business_registrations" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_name" text                     NOT NULL,
  "description"   text,
  "phone"         text                     NOT NULL,
  "contact_phone" text,
  "contact_name"  text                     NOT NULL,
  "municipio"     text                     NOT NULL,
  "status"        text                     NOT NULL DEFAULT 'pending'::text,
  "notes"         text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "offerings"     text[]                   NOT NULL DEFAULT '{}'::text[],
  "business_id"   uuid,
  "giro"          text,
  "photo_paths"   text[]                   NOT NULL DEFAULT '{}'::text[],
  "address"       text,
  "hours_note"    text,
  "social_url"    text,
  "source"        text,
  CONSTRAINT "business_registrations_giro_check" CHECK ((giro = ANY (ARRAY['comida'::text, 'comercial'::text]))),
  CONSTRAINT "business_registrations_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_registrations_source_check" CHECK (((source IS NULL) OR (source = ANY (ARRAY['landing'::text, 'app'::text])))),
  CONSTRAINT "business_registrations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT "business_registrations_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_registrations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_registrations_business_id_idx ON public.business_registrations USING btree (business_id);

CREATE INDEX business_registrations_source_created_idx ON public.business_registrations USING btree (source, created_at DESC);

CREATE POLICY "admin_select_business_registrations" ON "public"."business_registrations"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

CREATE POLICY "admin_update_business_registrations" ON "public"."business_registrations"
  FOR UPDATE
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "anon_insert_business_registrations" ON "public"."business_registrations"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_registrations" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."business_registrations" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_registrations" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_registrations"."address" IS 'Dirección en las palabras del dueño: calle y número, o una referencia del
   pueblo ("junto a la tienda de doña Mari"). Al aprobar se copia tal cual a
   businesses.address. No se geocodifica — el botón de ubicación de la app cae a
   una búsqueda de Google Maps por nombre + dirección, que con referencias
   locales funciona mejor que unas coordenadas mal puestas.';

COMMENT ON COLUMN "public"."business_registrations"."hours_note" IS 'Horario en texto libre ("9 a 6, domingos cerrado"). A propósito NO
   estructurado: business_hours son filas por día y soporta turnos partidos, y
   capturar eso en un formulario público es la parte más pesada de todas — se le
   pediría al dueño el trabajo que al admin le cuesta veinte segundos al
   aprobar. Este campo NO se mapea solo a ninguna columna de businesses: se
   muestra en el panel para que quien aprueba lo capture en el editor de
   horarios.';

COMMENT ON COLUMN "public"."business_registrations"."photo_paths" IS 'Paths dentro del bucket `registration-photos`, en orden: el primero es la portada. Es staging — al aprobar se copian a `business-photos` y se borran de aquí; al rechazar sólo se borran.';

COMMENT ON COLUMN "public"."business_registrations"."social_url" IS 'Facebook o Instagram, un solo campo. Se guarda como lo pegó el dueño y al
   aprobar se manda a businesses.facebook_url o instagram_url según el dominio:
   pedirle que distinga cuál es cuál sería fricción por nada.';

COMMENT ON COLUMN "public"."business_registrations"."source" IS 'Superficie por la que entró la solicitud: ''landing'' o ''app''. NULL en las
   41 solicitudes anteriores al 2026-08-25 — a propósito: no se rellenaron por
   inferencia. Quien quiera separarlas puede usar la heurística de que las de la
   app llegaban sin `giro` ni `offerings`, pero eso es una suposición y no debe
   quedar guardada como si fuera un dato.';
