-- Window to change an order before it reaches the restaurant (mikitasks 58re295uc).
--
-- Decided by the owner on 2026-11-26: after «Mandar pedido» the customer sees a
-- 15-second countdown with «Enviar ahora» and «Cambiar algo». The restaurant
-- only learns about an order through the WhatsApp notice, so the window is the
-- time between create_order and that notice:
--
-- - The app asks for the notice when the countdown ends or on «Enviar ahora».
-- - «Cambiar algo» withdraws the order with withdraw_order. A withdrawn order
--   never gets its notice, does not show in «Mis pedidos» and is not a pilot
--   order.
-- - If the app closes during the countdown, notify_due_orders, run by pg_cron,
--   asks for the notice of every order still waiting after the window. It also
--   covers an app that died right after create_order, which until now depended
--   on the customer opening the tracking screen again.
--
-- The race between «Cambiar algo» and the notice is settled by the row: the
-- notice is taken with pending → sending, withdraw_order needs it still
-- pending, and orders_guard refuses a notice on a withdrawn order. Whichever
-- update commits first wins; the other one matches no row.
--
-- The notice route URL lives in Vault as `orders_notify_url`, set once per
-- environment by the owner. Without it the job does nothing, which is the case
-- in the local DB: it cannot reach the admin running on a laptop.
-- Plan: `04 Execution/plans/Ventana para corregir el pedido.md` in the vault.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- The withdrawn status

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in ('pending', 'accepted', 'rejected', 'preparing', 'on_the_way', 'delivered', 'withdrawn')
);

comment on column public.orders.status is
  'pending → accepted or rejected; accepted → preparing → on_the_way → delivered. withdrawn: the customer changed it during the send window, before the restaurant got the notice (withdraw_order); for the restaurant and the pilot numbers it never existed. rejected, delivered and withdrawn are final.';

create or replace function public.order_status_transition_ok(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select (p_from, p_to) in (
    ('pending', 'accepted'),
    ('pending', 'rejected'),
    ('pending', 'withdrawn'),
    ('accepted', 'preparing'),
    ('preparing', 'on_the_way'),
    ('on_the_way', 'delivered')
  );
$function$;

comment on function public.order_status_transition_ok(text, text) is
  'Los únicos pasos válidos del pedido: pendiente → aceptado, rechazado o retirado por el cliente; aceptado → en preparación → en camino → entregado. Rechazado, entregado y retirado son finales. set_order_status no acepta retirado: solo withdraw_order lo pone.';

create or replace function public.orders_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending'
       or new.notify_status <> 'pending'
       or new.notify_error is not null
       or new.notify_updated_at is not null
       or num_nonnulls(new.accepted_at, new.rejected_at, new.preparing_at,
                       new.on_the_way_at, new.delivered_at) > 0 then
      raise exception 'order_must_start_pending' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Lo que el cliente pidió no cambia después de crearse.
  if (new.id, new.token, new.business_id, new.mode, new.subtotal_cents,
      new.delivery_fee_cents, new.total_cents, new.created_at)
     is distinct from
     (old.id, old.token, old.business_id, old.mode, old.subtotal_cents,
      old.delivery_fee_cents, old.total_cents, old.created_at) then
    raise exception 'order_is_immutable' using errcode = '42501';
  end if;

  -- De los platillos, lo único que se puede hacer es borrar las notas: son
  -- texto libre y el cliente puede escribir ahí su teléfono o su casa, así que
  -- la retención tiene que poder quitarlas igual que los datos del cliente.
  if new.items is distinct from old.items
     and new.items is distinct from (
       select jsonb_agg(e || jsonb_build_object('note', null) order by ord)
         from jsonb_array_elements(old.items) with ordinality as t(e, ord)
     ) then
    raise exception 'order_is_immutable' using errcode = '42501';
  end if;

  -- Los datos del cliente solo se pueden borrar (retención), nunca reescribir.
  if (new.customer_name is distinct from old.customer_name and new.customer_name is not null)
     or (new.customer_phone is distinct from old.customer_phone and new.customer_phone is not null)
     or (new.delivery_lat is distinct from old.delivery_lat and new.delivery_lat is not null)
     or (new.delivery_lng is distinct from old.delivery_lng and new.delivery_lng is not null)
     or (new.delivery_directions is distinct from old.delivery_directions and new.delivery_directions is not null)
     or (new.delivery_references is distinct from old.delivery_references and new.delivery_references is not null)
     or (new.pays_with is distinct from old.pays_with and new.pays_with is not null) then
    raise exception 'order_customer_data_is_immutable' using errcode = '42501';
  end if;

  -- Las horas de estado solo las escribe este trigger.
  if (new.accepted_at, new.rejected_at, new.preparing_at, new.on_the_way_at, new.delivered_at)
     is distinct from
     (old.accepted_at, old.rejected_at, old.preparing_at, old.on_the_way_at, old.delivered_at) then
    raise exception 'order_status_times_are_managed' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not public.order_status_transition_ok(old.status, new.status) then
      raise exception 'invalid_order_transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    -- Entregado lo marca solo el cliente, por confirm_order_received (security
    -- definer, corre como postgres). El servidor escribiendo directo no puede.
    if new.status = 'delivered' and current_user <> 'postgres' then
      raise exception 'only_customer_confirms_delivery' using errcode = '42501';
    end if;

    -- Withdrawn is only set by withdraw_order (security definer, runs as
    -- postgres), and only while the restaurant has not been told.
    if new.status = 'withdrawn' then
      if current_user <> 'postgres' then
        raise exception 'only_customer_withdraws' using errcode = '42501';
      end if;
      if old.notify_status <> 'pending' then
        raise exception 'order_already_notified' using errcode = '23514';
      end if;
    end if;

    case new.status
      when 'accepted' then new.accepted_at := now();
      when 'rejected' then new.rejected_at := now();
      when 'preparing' then new.preparing_at := now();
      when 'on_the_way' then new.on_the_way_at := now();
      when 'delivered' then new.delivered_at := now();
      -- No time of its own: it happens within the window, so created_at says
      -- when, and the retention counts 90 days from it.
      when 'withdrawn' then null;
    end case;
  end if;

  -- A withdrawn order is never announced to the restaurant.
  if new.status = 'withdrawn' and new.notify_status <> 'pending' then
    raise exception 'order_withdrawn' using errcode = '23514';
  end if;

  if new.notify_status is distinct from old.notify_status
     or new.notify_error is distinct from old.notify_error then
    new.notify_updated_at := now();
  elsif new.notify_updated_at is distinct from old.notify_updated_at then
    raise exception 'order_notify_time_is_managed' using errcode = '42501';
  end if;

  return new;
end;
$function$;

comment on function public.orders_guard() is
  'Trigger de orders. Al insertar exige estado y aviso pendientes. Al actualizar: lo pedido es inmutable salvo borrar las notas de los platillos, los datos del cliente solo pasan a null, el estado solo avanza por order_status_transition_ok, entregado solo lo pone confirm_order_received, retirado solo lo pone withdraw_order y con el aviso todavía pendiente, un pedido retirado nunca cambia su aviso, y la hora de cada estado y del aviso la pone el trigger.';

-- ---------------------------------------------------------------------------
-- «Cambiar algo»

-- How long after create_order the customer can still withdraw: the 15-second
-- window plus room for a slow network. The notice usually settles it first.
create function public.withdraw_order(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
begin
  update public.orders o
     set status = 'withdrawn'
   where o.token = p_token
     and o.status = 'pending'
     and o.notify_status = 'pending'
     and o.created_at > now() - interval '60 seconds';

  if found then
    return 'withdrawn';
  end if;

  select o.status into v_status
    from public.orders o
   where o.token = p_token;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  -- A retry after an answer that got lost on the way.
  if v_status = 'withdrawn' then
    return 'withdrawn';
  end if;

  return 'too_late';
end;
$function$;

comment on function public.withdraw_order(text) is
  '«Cambiar algo» del contador: retira el pedido del token mientras el restaurante no tenga el aviso (pendiente, aviso pendiente y menos de 60 s de creado). Devuelve withdrawn (también si ya estaba retirado) o too_late si el aviso ya salió o la ventana pasó. Errores: order_not_found.';

revoke all on function public.withdraw_order(text) from public, anon, authenticated;
grant execute on function public.withdraw_order(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The notice of an order whose app closed during the window

create index orders_notice_due_idx on public.orders (created_at)
  where status = 'pending' and notify_status = 'pending';

-- Only orders younger than 10 minutes: past that, a notice that never went out
-- is better left to the customer's tracking screen, which already tells them
-- to call the restaurant, than sent to a restaurant that is no longer
-- expecting it.
create function public.notify_due_orders()
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_url   text;
  v_count integer := 0;
  v_order record;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s
   where s.name = 'orders_notify_url';

  if v_url is null or btrim(v_url) = '' then
    return 0;
  end if;

  for v_order in
    select o.token
      from public.orders o
     where o.status = 'pending'
       and o.notify_status = 'pending'
       and o.created_at <= now() - interval '15 seconds'
       and o.created_at > now() - interval '10 minutes'
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('token', v_order.token),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 20000
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

comment on function public.notify_due_orders() is
  'Pide el aviso al restaurante de cada pedido pendiente con el aviso pendiente, creado hace más de 15 s (la ventana para cambiarlo) y menos de 10 min. Llama la ruta del admin guardada en Vault como orders_notify_url con pg_net; sin ella no hace nada. La ruta es idempotente, así que repetirla no manda dos avisos. Devuelve cuántos pidió. La corre pg_cron cada 30 s (job notify-due-orders); solo postgres.';

revoke all on function public.notify_due_orders() from public, anon, authenticated, service_role;

-- cron.schedule with an existing name updates that job instead of adding one.
select cron.schedule(
  'notify-due-orders',
  '30 seconds',
  $$select public.notify_due_orders()$$
);
