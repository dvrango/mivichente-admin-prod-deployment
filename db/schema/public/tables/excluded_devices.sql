CREATE TABLE "public"."excluded_devices" (
  "device_id"  text                     NOT NULL,
  "label"      text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "excluded_devices_pkey" PRIMARY KEY (device_id)
);

ALTER TABLE "public"."excluded_devices"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."excluded_devices" TO "postgres", "service_role";
