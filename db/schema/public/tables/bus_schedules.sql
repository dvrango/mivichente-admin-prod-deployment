CREATE TABLE "public"."bus_schedules" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "company"     text                     NOT NULL,
  "route_from"  text                     NOT NULL,
  "route_to"    text                     NOT NULL,
  "times"       text[]                   NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now(),
  "extra_times" jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "bus_schedules_company_route_from_route_to_key" UNIQUE (company, route_from, route_to),
  CONSTRAINT "bus_schedules_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."bus_schedules"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON "public"."bus_schedules"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."bus_schedules" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."bus_schedules" TO "postgres", "service_role";
