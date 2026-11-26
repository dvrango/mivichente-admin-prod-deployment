CREATE TABLE "public"."order_retention_runs" (
  "id"            bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ran_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "orders_purged" integer                  NOT NULL,
  CONSTRAINT "order_retention_runs_count_check" CHECK ((orders_purged >= 0)),
  CONSTRAINT "order_retention_runs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."order_retention_runs"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_retention_runs" TO "postgres";

COMMENT ON TABLE "public"."order_retention_runs" IS 'One row per run of purge_order_customer_data: when it ran and how many orders it cleaned. No order ids or customer data. The backup heartbeat reads it from the dump to tell whether the purge stopped running. Rows older than 400 days are trimmed by the purge itself.';
