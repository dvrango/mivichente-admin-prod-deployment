CREATE TABLE "public"."order_funnel_events" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "device_id"   text                     NOT NULL,
  "business_id" uuid                     NOT NULL,
  "step"        text                     NOT NULL,
  "item_count"  integer,
  "total_cents" integer,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "order_funnel_events_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "order_funnel_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "order_funnel_events_step_check" CHECK ((step = ANY (ARRAY['menu_viewed'::text, 'item_added'::text, 'checkout_started'::text, 'whatsapp_opened'::text]))),
  CONSTRAINT "order_funnel_events_totals_check" CHECK (((step = 'whatsapp_opened'::text) OR ((item_count IS NULL) AND (total_cents IS NULL))))
);

ALTER TABLE "public"."order_funnel_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX order_funnel_events_business_step_created_idx ON public.order_funnel_events USING btree (business_id, step, created_at DESC);

CREATE INDEX order_funnel_events_device_created_idx ON public.order_funnel_events USING btree (device_id, created_at DESC);

CREATE POLICY "anyone can log an order funnel event" ON "public"."order_funnel_events"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT INSERT ON TABLE "public"."order_funnel_events" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_funnel_events" TO "postgres", "service_role";
