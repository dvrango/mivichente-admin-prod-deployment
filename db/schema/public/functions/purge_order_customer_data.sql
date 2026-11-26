CREATE OR REPLACE FUNCTION public.purge_order_customer_data()
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_count integer;
begin
  -- The status only moves forward and orders_guard stamps one time per status,
  -- so the last change is the greatest of them (greatest skips nulls).
  -- The items expression is the exact one orders_guard accepts: same array with
  -- every note set to null.
  update public.orders o
     set customer_name       = null,
         customer_phone      = null,
         delivery_lat        = null,
         delivery_lng        = null,
         delivery_directions = null,
         delivery_references = null,
         pays_with           = null,
         items = (
           select jsonb_agg(e || jsonb_build_object('note', null) order by ord)
             from jsonb_array_elements(o.items) with ordinality as t(e, ord)
         )
   where greatest(o.created_at, o.accepted_at, o.rejected_at, o.preparing_at,
                  o.on_the_way_at, o.delivered_at) < now() - interval '90 days'
     and (
       num_nonnulls(o.customer_name, o.customer_phone, o.delivery_lat, o.delivery_lng,
                    o.delivery_directions, o.delivery_references, o.pays_with) > 0
       or exists (
         select 1
           from jsonb_array_elements(o.items) as i(e)
          where i.e ->> 'note' is not null
       )
     );

  get diagnostics v_count = row_count;

  insert into public.order_retention_runs (orders_purged) values (v_count);
  delete from public.order_retention_runs where ran_at < now() - interval '400 days';

  return v_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."purge_order_customer_data"() TO "postgres";

COMMENT ON FUNCTION "public"."purge_order_customer_data"() IS 'Erases the customer data (name, phone, location, directions, references, pays_with and item notes) of orders whose last status change is older than 90 days, and logs the run in order_retention_runs. Only touches orders with something left to erase, so a second run cleans 0. Returns how many it cleaned. Scheduled daily by pg_cron (job purge-order-customer-data); only postgres runs it.';

REVOKE ALL ON FUNCTION "public"."purge_order_customer_data"() FROM PUBLIC;
