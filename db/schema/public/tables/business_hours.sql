CREATE TABLE "public"."business_hours" (
  "id"          uuid                   NOT NULL DEFAULT gen_random_uuid(),
  "business_id" uuid                   NOT NULL,
  "day_of_week" smallint               NOT NULL,
  "opens_at"    time without time zone NOT NULL,
  "closes_at"   time without time zone NOT NULL,
  CONSTRAINT "business_hours_business_day_opens_key" UNIQUE (business_id, day_of_week, opens_at),
  CONSTRAINT "business_hours_day_of_week_check" CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
  CONSTRAINT "business_hours_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_hours_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

ALTER TABLE "public"."business_hours"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_business_hours_business_id ON public.business_hours USING btree (business_id);

CREATE POLICY "business_hours_delete" ON "public"."business_hours"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_hours.business_id) AND (public.is_admin() OR (b.municipio = public.user_municipio()))))));

CREATE POLICY "business_hours_insert" ON "public"."business_hours"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_hours.business_id) AND (public.is_admin() OR (b.municipio = public.user_municipio()))))));

CREATE POLICY "business_hours_public_read" ON "public"."business_hours"
  FOR SELECT
  TO "anon"
  USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = business_hours.business_id) AND (b.is_active = true)))));

CREATE POLICY "business_hours_select_auth" ON "public"."business_hours"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_hours" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."business_hours" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_hours" TO "postgres", "service_role";

COMMENT ON TABLE "public"."business_hours" IS 'Horario semanal. Puede haber más de una fila por negocio+día (horario partido: mañana y tarde). day_of_week: 0=Dom … 6=Sáb. Sin filas para un día = cerrado.';
