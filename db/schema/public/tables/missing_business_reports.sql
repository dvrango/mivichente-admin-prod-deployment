CREATE TABLE "public"."missing_business_reports" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "query"       text                     NOT NULL,
  "note"        text,
  "typed"       boolean                  NOT NULL,
  "device_id"   text,
  "status"      text                     NOT NULL DEFAULT 'pending'::text,
  "reviewed_at" timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "missing_business_reports_note_length" CHECK (((note IS NULL) OR ((char_length(note) >= 1) AND (char_length(note) <= 1000)))),
  CONSTRAINT "missing_business_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "missing_business_reports_query_length" CHECK (((char_length(btrim(query)) >= 2) AND (char_length(btrim(query)) <= 100))),
  CONSTRAINT "missing_business_reports_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text, 'dismissed'::text])))
);

ALTER TABLE "public"."missing_business_reports"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX missing_business_reports_status_created_idx ON public.missing_business_reports USING btree (status, created_at DESC);

CREATE POLICY "missing_business_reports_insert" ON "public"."missing_business_reports"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (((status = 'pending'::text) AND (reviewed_at IS NULL)));

CREATE POLICY "missing_business_reports_select_staff" ON "public"."missing_business_reports"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "missing_business_reports_update_staff" ON "public"."missing_business_reports"
  FOR UPDATE
  TO "authenticated"
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

GRANT INSERT ("device_id") ON TABLE "public"."missing_business_reports" TO "anon";

GRANT INSERT ("note") ON TABLE "public"."missing_business_reports" TO "anon";

GRANT INSERT ("query") ON TABLE "public"."missing_business_reports" TO "anon";

GRANT INSERT ("typed") ON TABLE "public"."missing_business_reports" TO "anon";

GRANT INSERT ("device_id") ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT INSERT ("note") ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT INSERT ("query") ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT UPDATE ("reviewed_at") ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT UPDATE ("status") ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT INSERT ("typed") ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT SELECT ON TABLE "public"."missing_business_reports" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."missing_business_reports" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."missing_business_reports"."note" IS 'Texto opcional del usuario: nombre del negocio, dónde está, teléfono.';

COMMENT ON COLUMN "public"."missing_business_reports"."query" IS 'Término que el usuario buscó y no dio resultados, tal cual (trim).';

COMMENT ON COLUMN "public"."missing_business_reports"."status" IS '''pending'' al crearse; el staff lo pasa a ''resolved'' (se atendió) o ''dismissed'' (ruido).';

COMMENT ON COLUMN "public"."missing_business_reports"."typed" IS 'true si el término lo tecleó la persona; false si llegó por un tap de categoría del home, un deep link o una búsqueda reciente. search_events no distingue esto.';

COMMENT ON TABLE "public"."missing_business_reports" IS 'Aviso de un negocio que falta, enviado desde el estado vacío de la búsqueda de la app. Lo crea anon; lo lee y lo marca el staff. No se borra: el término es el dato del levantamiento.';
