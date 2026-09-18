-- Telemetría mínima del carrito por WhatsApp. La primera etapa no persiste
-- pedidos, así que estos cuatro pasos son la única lectura del piloto.
-- Ninguna columna guarda PII ni contenido del formulario del checkout.

create table public.order_funnel_events (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  step        text not null,
  item_count  integer,
  total_cents integer,
  created_at  timestamptz not null default now(),
  constraint order_funnel_events_step_check
    check (step in ('menu_viewed', 'item_added', 'checkout_started', 'whatsapp_opened')),
  constraint order_funnel_events_totals_check
    check (step = 'whatsapp_opened' or (item_count is null and total_cents is null))
);

create index order_funnel_events_business_step_created_idx
  on public.order_funnel_events (business_id, step, created_at desc);
create index order_funnel_events_device_created_idx
  on public.order_funnel_events (device_id, created_at desc);

alter table public.order_funnel_events enable row level security;

create policy "anyone can log an order funnel event"
  on public.order_funnel_events
  for insert
  to anon, authenticated
  with check (true);

-- Supabase puede heredar grants amplios por default privileges. Dejar sólo la
-- operación que necesita el cliente evita que una policy futura abra lecturas
-- por accidente sin que también exista un grant explícito.
revoke all on public.order_funnel_events from anon, authenticated;
grant insert on public.order_funnel_events to anon, authenticated;

create table public.excluded_devices (
  device_id  text primary key,
  label      text not null,
  created_at timestamptz not null default now()
);

alter table public.excluded_devices enable row level security;
revoke all on public.excluded_devices from anon, authenticated;

-- Conserva la exclusión que antes vivía como constante en metrics/queries.ts.
insert into public.excluded_devices (device_id, label)
values ('76be25ff-1906-45ff-a829-46fbc828eecd', 'Dispositivo de pruebas original');
