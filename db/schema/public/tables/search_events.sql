CREATE TABLE "public"."search_events" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "device_id"    text                     NOT NULL,
  "query"        text                     NOT NULL,
  "result_count" integer                  NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "search_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."search_events"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can log a search event" ON "public"."search_events"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."search_events" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."search_events" TO "postgres", "service_role";
