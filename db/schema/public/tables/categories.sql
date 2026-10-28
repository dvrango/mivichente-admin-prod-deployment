CREATE TABLE "public"."categories" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "icon"       text,
  "type"       text                     NOT NULL,
  "is_active"  boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "aliases"    text[]                   NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT "categories_pkey" PRIMARY KEY (id),
  CONSTRAINT "categories_type_check" CHECK ((type = ANY (ARRAY['food'::text, 'business'::text])))
);

ALTER TABLE "public"."categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER categories_resync_services_label
  AFTER UPDATE OF TYPE ON public.categories
  FOR EACH ROW
  WHEN ((old.type IS DISTINCT FROM new.type))
  EXECUTE FUNCTION public.resync_services_label_on_category_type();

CREATE POLICY "categories_delete" ON "public"."categories"
  FOR DELETE
  TO "authenticated"
  USING (public.is_admin());

CREATE POLICY "categories_insert" ON "public"."categories"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_public_read" ON "public"."categories"
  FOR SELECT
  TO "anon"
  USING ((is_active = true));

CREATE POLICY "categories_select_auth" ON "public"."categories"
  FOR SELECT
  TO "authenticated"
  USING (public.is_staff());

CREATE POLICY "categories_update" ON "public"."categories"
  FOR UPDATE
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."categories" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."categories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "postgres", "service_role";
