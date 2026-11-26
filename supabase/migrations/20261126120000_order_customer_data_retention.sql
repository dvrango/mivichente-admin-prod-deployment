-- Retention of the customer's data on orders (mikitasks uuyrkazz7).
--
-- Rule decided by the owner on 2026-11-26: 90 days after the order's last status
-- change, however it ended (delivered, rejected, pending nobody answered, on the
-- way and never confirmed), the customer's data is erased. What stays is what the
-- pilot is read with: the items, the totals, the times and the status.
--
-- Erased: name, phone, location (coordinates and directions), references, what
-- they pay with, and the note of each item. The notes and the directions are free
-- text where a customer can write their house, so they go too.
--
-- pg_cron runs it daily inside the database. Each run leaves a row in
-- order_retention_runs (time and count, nothing about the orders); that table
-- travels in the nightly backup dump, and the backup's Sunday heartbeat reads it
-- to say when the last run was. Plan: `04 Execution/plans/Retención de los datos
-- del pedido.md` in the vault.

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Run log

create table public.order_retention_runs (
  id             bigint      generated always as identity,
  ran_at         timestamptz not null default now(),
  orders_purged  integer     not null,
  constraint order_retention_runs_pkey primary key (id),
  constraint order_retention_runs_count_check check (orders_purged >= 0)
);

alter table public.order_retention_runs enable row level security;

comment on table public.order_retention_runs is
  'One row per run of purge_order_customer_data: when it ran and how many orders it cleaned. No order ids or customer data. The backup heartbeat reads it from the dump to tell whether the purge stopped running. Rows older than 400 days are trimmed by the purge itself.';

-- Supabase hands out broad grants through default privileges. Nobody outside
-- postgres needs this table.
revoke all on public.order_retention_runs from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The purge

create function public.purge_order_customer_data()
returns integer
language plpgsql
set search_path = ''
as $function$
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

comment on function public.purge_order_customer_data() is
  'Erases the customer data (name, phone, location, directions, references, pays_with and item notes) of orders whose last status change is older than 90 days, and logs the run in order_retention_runs. Only touches orders with something left to erase, so a second run cleans 0. Returns how many it cleaned. Scheduled daily by pg_cron (job purge-order-customer-data); only postgres runs it.';

revoke all on function public.purge_order_customer_data() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Schedule: 09:00 UTC is 03:00 in Durango (UTC-6, no DST), half an hour before
-- the nightly backup, so that night's dump already comes without expired data.
-- cron.schedule with an existing name updates that job instead of adding one.

select cron.schedule(
  'purge-order-customer-data',
  '0 9 * * *',
  $$select public.purge_order_customer_data()$$
);
