CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "role"       text                     NOT NULL DEFAULT 'pending'::text,
  "municipio"  text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "email"      text,
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'reviewer'::text, 'pending'::text, 'owner'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_admin" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin());

CREATE POLICY "profiles_select_own" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((id = auth.uid()));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."profiles"."role" IS 'admin | reviewer | pending | owner. `pending` es el default de toda cuenta nueva y no da acceso a nada: un admin le asigna rol y municipio desde el dashboard de Supabase. `owner` es el dueño de un negocio: solo lee sus negocios (ver business_owners) vía owner_business_snapshot(). No existe policy de UPDATE sobre profiles, así que nadie se autopromueve.';
