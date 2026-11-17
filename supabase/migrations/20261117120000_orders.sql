-- Pedido con estados para el piloto (mikitasks ypol0a1j4).
--
-- En un negocio con el flujo encendido, el pedido deja de terminar en el
-- WhatsApp del cliente: se guarda aquí, al restaurante le llega por WhatsApp
-- con botones (njr8m6mp2, rutas de API del admin) y el cliente ve en qué va
-- desde la app (875wfu83g). Plan: `04 Execution/plans/Pedido con estados.md`.
--
-- Quién hace qué:
--   anon           crea su pedido, lo lee y confirma que lo recibió, siempre por
--                  funciones y con el token del pedido. No tiene grants sobre
--                  la tabla: una policy no ve el filtro de la consulta, así que
--                  cualquier select que se le diera listaría la tabla entera.
--   service_role   el servidor del admin. Cambia el estado con set_order_status
--                  y anota el aviso al restaurante directo en la tabla.
--   admin          lee la tabla.
-- El trigger orders_guard impide transiciones inválidas y que cambie lo que el
-- cliente pidió, aunque quien escriba sea service_role.

-- ---------------------------------------------------------------------------
-- El interruptor por negocio

alter table public.businesses
  add column order_tracking boolean not null default false;

comment on column public.businesses.order_tracking is
  'El negocio recibe los pedidos guardados en Vichente, con estados que ve el cliente, en vez de por el WhatsApp del cliente. Piloto. Crear un pedido exige además accepts_orders. Solo un admin lo cambia.';

-- Mismo patrón que accepts_orders e is_demo: la policy businesses_update deja
-- escribir al revisor de su municipio, y sin este guard podría encender el
-- flujo en un negocio real.
create function public.guard_business_order_tracking_admin()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if (
    (tg_op = 'INSERT' and new.order_tracking)
    or (tg_op = 'UPDATE' and old.order_tracking is distinct from new.order_tracking)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.order_tracking'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

comment on function public.guard_business_order_tracking_admin() is
  'Impide que cualquier identidad de aplicación distinta de admin encienda o apague el pedido con estados. Solo exceptúa postgres para operación de infraestructura.';

revoke all on function public.guard_business_order_tracking_admin() from public, anon, authenticated;

create trigger businesses_order_tracking_admin_only
  before insert or update of order_tracking on public.businesses
  for each row
  execute function public.guard_business_order_tracking_admin();

-- ---------------------------------------------------------------------------
-- La tabla

create table public.orders (
  id                  uuid        not null default gen_random_uuid(),
  token               text        not null default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  business_id         uuid        not null,
  status              text        not null default 'pending',
  mode                text        not null,
  items               jsonb       not null,
  subtotal_cents      integer     not null,
  delivery_fee_cents  integer,
  total_cents         integer     not null,
  customer_name       text,
  customer_phone      text,
  delivery_lat        double precision,
  delivery_lng        double precision,
  delivery_directions text,
  delivery_references text,
  pays_with           text,
  notify_status       text        not null default 'pending',
  notify_error        text,
  notify_updated_at   timestamptz,
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  preparing_at        timestamptz,
  on_the_way_at       timestamptz,
  delivered_at        timestamptz,
  constraint orders_pkey primary key (id),
  constraint orders_token_key unique (token),
  constraint orders_business_id_fkey foreign key (business_id)
    references public.businesses(id) on delete cascade,
  constraint orders_status_check check (
    status in ('pending', 'accepted', 'rejected', 'preparing', 'on_the_way', 'delivered')
  ),
  constraint orders_mode_check check (mode in ('delivery', 'pickup')),
  constraint orders_items_check check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50
  ),
  constraint orders_amounts_check check (
    subtotal_cents >= 0
    and (delivery_fee_cents is null or delivery_fee_cents >= 0)
    and total_cents = subtotal_cents + coalesce(delivery_fee_cents, 0)
  ),
  constraint orders_pickup_check check (
    mode = 'delivery'
    or (
      delivery_fee_cents = 0
      and delivery_lat is null
      and delivery_directions is null
      and delivery_references is null
    )
  ),
  constraint orders_location_pair_check check ((delivery_lat is null) = (delivery_lng is null)),
  constraint orders_notify_status_check check (
    notify_status in ('pending', 'sending', 'sent', 'failed')
  ),
  constraint orders_notify_error_check check (notify_error is null or notify_status = 'failed')
);

create index orders_business_created_idx on public.orders (business_id, created_at desc);

alter table public.orders enable row level security;

comment on table public.orders is
  'Pedido del flujo con estados (piloto). Anon no tiene grants: crea, lee y confirma su pedido por token vía create_order / get_order / confirm_order_received. El servidor cambia el estado con set_order_status (service_role) y anota el aviso al restaurante en notify_*. Solo el admin lee la tabla. Un pedido solo nace por create_order: service_role no tiene INSERT. orders_guard impide transiciones inválidas y cambios a lo pedido.';

comment on column public.orders.token is
  'Secreto con el que el cliente lee su pedido; la app lo guarda en el dispositivo. El id no es secreto: puede ir en registros y en los botones de WhatsApp, y no sirve para leer el pedido.';
comment on column public.orders.items is
  'Foto de lo pedido al crearse, con precios del menú vigente en ese momento: [{service_id, name, variant_id, variant_name, options: [{group_id, group_name, option_id, name, price_delta_cents}], quantity, unit_price_cents, line_total_cents, note}]. No cambia aunque cambie el menú.';
comment on column public.orders.delivery_fee_cents is
  'Envío al crearse. null = por confirmar con el negocio (businesses.delivery_fee null), 0 = gratis o paso por él.';
comment on column public.orders.customer_phone is
  '10 dígitos. Obligatorio al crear (create_order). Nulable para que la retención pueda borrarlo; una vez escrito solo puede pasar a null.';
comment on column public.orders.delivery_directions is
  'Cómo llegar, cuando el cliente no marcó en el mapa. A domicilio se exige esto o delivery_lat/lng.';
comment on column public.orders.notify_status is
  'Aviso al restaurante: pending (nadie lo ha tomado), sending (el servidor lo está mandando), sent (Meta lo aceptó), failed (Meta lo rechazó; el detalle en notify_error). Lo escribe el servidor.';
comment on column public.orders.accepted_at is
  'Hora del cambio a ese estado; igual rejected_at, preparing_at, on_the_way_at y delivered_at. Las escribe orders_guard, nadie más.';

-- Supabase da grants amplios por default privileges. Anon no recibe ninguno; el
-- admin lee por policy.
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
-- Un pedido solo nace por create_order, que valida negocio, menú y total. El
-- servidor tampoco inserta ni vacía la tabla directo.
revoke insert, truncate on public.orders from service_role;

create policy "admin reads orders" on public.orders
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Transiciones: una sola definición, la usan el trigger y set_order_status.

create function public.order_status_transition_ok(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select (p_from, p_to) in (
    ('pending', 'accepted'),
    ('pending', 'rejected'),
    ('accepted', 'preparing'),
    ('preparing', 'on_the_way'),
    ('on_the_way', 'delivered')
  );
$function$;

comment on function public.order_status_transition_ok(text, text) is
  'Los únicos pasos válidos del pedido: pendiente → aceptado o rechazado, aceptado → en preparación → en camino → entregado. Rechazado y entregado son finales.';

revoke all on function public.order_status_transition_ok(text, text) from public, anon, authenticated;
grant execute on function public.order_status_transition_ok(text, text) to service_role;

create function public.orders_guard()
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
  if (new.id, new.token, new.business_id, new.mode, new.items, new.subtotal_cents,
      new.delivery_fee_cents, new.total_cents, new.created_at)
     is distinct from
     (old.id, old.token, old.business_id, old.mode, old.items, old.subtotal_cents,
      old.delivery_fee_cents, old.total_cents, old.created_at) then
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

    case new.status
      when 'accepted' then new.accepted_at := now();
      when 'rejected' then new.rejected_at := now();
      when 'preparing' then new.preparing_at := now();
      when 'on_the_way' then new.on_the_way_at := now();
      when 'delivered' then new.delivered_at := now();
    end case;
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
  'Trigger de orders. Al insertar exige estado y aviso pendientes. Al actualizar: lo pedido es inmutable, los datos del cliente solo pasan a null, el estado solo avanza por order_status_transition_ok, entregado solo lo pone confirm_order_received y la hora de cada estado y del aviso la pone el trigger.';

revoke all on function public.orders_guard() from public, anon, authenticated;

create trigger orders_guard
  before insert or update on public.orders
  for each row
  execute function public.orders_guard();

-- ---------------------------------------------------------------------------
-- Funciones del cliente (anon)

create function public.create_order(
  p_business_id           uuid,
  p_items                 jsonb,
  p_mode                  text,
  p_customer_name         text,
  p_customer_phone        text,
  p_expected_total_cents  integer,
  p_delivery_lat          double precision default null,
  p_delivery_lng          double precision default null,
  p_delivery_directions   text default null,
  p_delivery_references   text default null,
  p_pays_with             text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business    public.businesses%rowtype;
  v_name        text := nullif(btrim(p_customer_name), '');
  v_phone       text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_directions  text := nullif(btrim(p_delivery_directions), '');
  v_references  text := nullif(btrim(p_delivery_references), '');
  v_pays_with   text := nullif(btrim(p_pays_with), '');
  v_lat         double precision := p_delivery_lat;
  v_lng         double precision := p_delivery_lng;
  v_item        jsonb;
  v_service     public.business_services%rowtype;
  v_variant     public.business_service_variants%rowtype;
  v_variant_id  uuid;
  v_option_ids  uuid[];
  v_options     jsonb;
  v_options_sum integer;
  v_quantity    integer;
  v_note        text;
  v_unit        integer;
  v_subtotal    integer := 0;
  v_fee         integer;
  v_total       integer;
  v_snapshot    jsonb := '[]'::jsonb;
  v_token       text;
begin
  select * into v_business
    from public.businesses b
   where b.id = p_business_id;

  if not found
     or not v_business.is_active
     or not v_business.accepts_orders
     or not v_business.order_tracking then
    raise exception 'orders_not_available' using errcode = 'P0001';
  end if;

  if coalesce(
       nullif(btrim(v_business.whatsapp_phone), ''),
       case when v_business.phone_is_whatsapp then nullif(btrim(v_business.phone), '') end
     ) is null then
    raise exception 'business_without_whatsapp' using errcode = 'P0001';
  end if;

  if p_mode is null or p_mode not in ('delivery', 'pickup') then
    raise exception 'invalid_mode' using errcode = '22023';
  end if;
  if p_mode = 'delivery' and not v_business.has_delivery then
    raise exception 'delivery_not_available' using errcode = 'P0001';
  end if;

  if v_name is null or char_length(v_name) > 80 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;

  -- Teléfono mexicano: 10 dígitos, con o sin 52 / 521 adelante.
  if char_length(v_phone) = 13 and left(v_phone, 3) = '521' then
    v_phone := right(v_phone, 10);
  elsif char_length(v_phone) = 12 and left(v_phone, 2) = '52' then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone !~ '^[0-9]{10}$' then
    raise exception 'invalid_customer_phone' using errcode = '22023';
  end if;

  if v_pays_with is not null and char_length(v_pays_with) > 40 then
    raise exception 'invalid_pays_with' using errcode = '22023';
  end if;

  if p_mode = 'pickup' then
    -- Paso por él: no hay a dónde llevarlo.
    v_lat := null;
    v_lng := null;
    v_directions := null;
    v_references := null;
    v_fee := 0;
  else
    if (v_lat is null) <> (v_lng is null)
       or (v_lat is not null and (v_lat not between -90 and 90 or v_lng not between -180 and 180)) then
      raise exception 'invalid_location' using errcode = '22023';
    end if;
    if v_lat is null and v_directions is null then
      raise exception 'location_required' using errcode = '22023';
    end if;
    if (v_directions is not null and char_length(v_directions) > 300)
       or (v_references is not null and char_length(v_references) > 200) then
      raise exception 'invalid_location' using errcode = '22023';
    end if;
    v_fee := case
      when v_business.delivery_fee is null then null
      else round(v_business.delivery_fee * 100)::integer
    end;
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'quantity') <> 'number'
       or (v_item ? 'option_ids' and jsonb_typeof(v_item -> 'option_ids') not in ('array', 'null')) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;

    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity::numeric <> (v_item ->> 'quantity')::numeric or v_quantity not between 1 and 99 then
      raise exception 'invalid_items' using errcode = '22023';
    end if;

    v_note := nullif(btrim(v_item ->> 'note'), '');
    if v_note is not null and char_length(v_note) > 200 then
      raise exception 'invalid_items' using errcode = '22023';
    end if;

    select * into v_service
      from public.business_services s
     where s.id = (v_item ->> 'service_id')::uuid
       and s.business_id = v_business.id
       and s.is_published;
    if not found then
      raise exception 'item_not_available' using errcode = 'P0001';
    end if;

    -- Tamaño: si el platillo tiene tamaños, uno es obligatorio y fija el precio.
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    if exists (select 1 from public.business_service_variants v where v.service_id = v_service.id) then
      select * into v_variant
        from public.business_service_variants v
       where v.id = v_variant_id
         and v.service_id = v_service.id;
      if not found then
        raise exception 'item_not_available' using errcode = 'P0001';
      end if;
      v_unit := round(v_variant.price * 100)::integer;
    else
      if v_variant_id is not null then
        raise exception 'item_not_available' using errcode = 'P0001';
      end if;
      if v_service.price is null then
        raise exception 'item_without_price' using errcode = 'P0001';
      end if;
      v_variant := null;
      v_unit := round(v_service.price * 100)::integer;
    end if;

    -- Opciones: cada una de un grupo de este platillo, sin repetir, y cada
    -- grupo dentro de su mínimo y máximo (un grupo obligatorio sin elegir falla).
    select coalesce(array_agg(x::uuid), '{}')
      into v_option_ids
      from jsonb_array_elements_text(coalesce(nullif(v_item -> 'option_ids', 'null'::jsonb), '[]'::jsonb)) x;

    if cardinality(v_option_ids) <> (select count(distinct o) from unnest(v_option_ids) o) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;

    if cardinality(v_option_ids) <> (
      select count(*)
        from public.business_service_options o
        join public.business_service_option_groups g on g.id = o.group_id
       where o.id = any (v_option_ids)
         and g.service_id = v_service.id
    ) then
      raise exception 'item_not_available' using errcode = 'P0001';
    end if;

    if exists (
      select 1
        from public.business_service_option_groups g
        left join public.business_service_options o
          on o.group_id = g.id and o.id = any (v_option_ids)
       where g.service_id = v_service.id
       group by g.id, g.min_select, g.max_select
      having count(o.id) < g.min_select
          or (g.max_select is not null and count(o.id) > g.max_select)
    ) then
      raise exception 'item_options_invalid' using errcode = 'P0001';
    end if;

    select coalesce(sum(round(o.price_delta * 100))::integer, 0),
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'group_id', g.id,
                 'group_name', g.name,
                 'option_id', o.id,
                 'name', o.name,
                 'price_delta_cents', round(o.price_delta * 100)::integer
               )
               order by g.order_index, g.created_at, g.id, o.order_index, o.created_at, o.id
             ),
             '[]'::jsonb
           )
      into v_options_sum, v_options
      from public.business_service_options o
      join public.business_service_option_groups g on g.id = o.group_id
     where o.id = any (v_option_ids);

    v_unit := v_unit + v_options_sum;
    v_subtotal := v_subtotal + v_unit * v_quantity;

    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'service_id', v_service.id,
      'name', v_service.name,
      'variant_id', v_variant.id,
      'variant_name', v_variant.name,
      'options', v_options,
      'quantity', v_quantity,
      'unit_price_cents', v_unit,
      'line_total_cents', v_unit * v_quantity,
      'note', v_note
    ));
  end loop;

  v_total := v_subtotal + coalesce(v_fee, 0);

  -- El cliente acepta un total en la app; si el menú o el envío cambiaron
  -- desde entonces, no se guarda un importe distinto del que vio.
  if p_expected_total_cents is distinct from v_total then
    raise exception 'price_changed' using errcode = 'P0001';
  end if;

  insert into public.orders (
    business_id, mode, items, subtotal_cents, delivery_fee_cents, total_cents,
    customer_name, customer_phone, delivery_lat, delivery_lng,
    delivery_directions, delivery_references, pays_with
  ) values (
    v_business.id, p_mode, v_snapshot, v_subtotal, v_fee, v_total,
    v_name, v_phone, v_lat, v_lng,
    v_directions, v_references, v_pays_with
  )
  returning token into v_token;

  return v_token;
end;
$function$;

comment on function public.create_order(uuid, jsonb, text, text, text, integer, double precision, double precision, text, text, text) is
  'Crea un pedido del flujo con estados y devuelve su token. p_items: [{service_id, variant_id?, option_ids?, quantity, note?}]. Los precios salen del menú vigente; price_changed si el total no es p_expected_total_cents. Errores (mensaje): orders_not_available, business_without_whatsapp, delivery_not_available, item_not_available, item_without_price, item_options_invalid, price_changed (P0001); invalid_mode, invalid_customer_name, invalid_customer_phone, invalid_pays_with, invalid_location, location_required, invalid_items (22023).';

create function public.get_order(p_token text)
returns table (
  business_id         uuid,
  status              text,
  mode                text,
  items               jsonb,
  subtotal_cents      integer,
  delivery_fee_cents  integer,
  total_cents         integer,
  notify_status       text,
  created_at          timestamptz,
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  preparing_at        timestamptz,
  on_the_way_at       timestamptz,
  delivered_at        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select o.business_id, o.status, o.mode, o.items, o.subtotal_cents,
         o.delivery_fee_cents, o.total_cents, o.notify_status, o.created_at,
         o.accepted_at, o.rejected_at, o.preparing_at, o.on_the_way_at,
         o.delivered_at
    from public.orders o
   where o.token = p_token;
$function$;

comment on function public.get_order(text) is
  'El pedido del token, sin datos del cliente (nombre, teléfono, ubicación): quien tiene el token ya los conoce, y un token filtrado expone menos. Token inexistente: sin filas.';

create function public.confirm_order_received(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id     uuid;
  v_status text;
begin
  select o.id, o.status into v_id, v_status
    from public.orders o
   where o.token = p_token
     for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_status = 'delivered' then
    return v_status;
  end if;

  if v_status <> 'on_the_way' then
    raise exception 'order_not_on_the_way' using errcode = 'P0001';
  end if;

  update public.orders set status = 'delivered' where id = v_id;
  return 'delivered';
end;
$function$;

comment on function public.confirm_order_received(text) is
  'El cliente confirma «ya lo recibí»: en camino → entregado. Repetirlo sobre un entregado no hace nada. Errores: order_not_found, order_not_on_the_way.';

-- ---------------------------------------------------------------------------
-- Función del servidor (service_role)

create function public.set_order_status(p_order_id uuid, p_status text)
returns table (status text, changed boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current text;
begin
  if p_status is null or p_status not in ('accepted', 'rejected', 'preparing', 'on_the_way') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  select o.status into v_current
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if public.order_status_transition_ok(v_current, p_status) then
    update public.orders o set status = p_status where o.id = p_order_id;
    return query select p_status, true;
  else
    -- Toque repetido, de un mensaje viejo o fuera de orden: no se mueve.
    return query select v_current, false;
  end if;
end;
$function$;

comment on function public.set_order_status(uuid, text) is
  'El restaurante cambia el estado desde WhatsApp (vía el servidor): aceptado, rechazado, en preparación o en camino. Si el paso no es válido desde el estado actual (repetido, viejo, salta pasos) no cambia nada y devuelve changed = false con el estado actual. Entregado solo lo marca el cliente. Errores: invalid_status, order_not_found.';

revoke all on function public.create_order(uuid, jsonb, text, text, text, integer, double precision, double precision, text, text, text) from public, anon, authenticated;
revoke all on function public.get_order(text) from public, anon, authenticated;
revoke all on function public.confirm_order_received(text) from public, anon, authenticated;
revoke all on function public.set_order_status(uuid, text) from public, anon, authenticated;

grant execute on function public.create_order(uuid, jsonb, text, text, text, integer, double precision, double precision, text, text, text) to anon, authenticated;
grant execute on function public.get_order(text) to anon, authenticated;
grant execute on function public.confirm_order_received(text) to anon, authenticated;
grant execute on function public.set_order_status(uuid, text) to service_role;
