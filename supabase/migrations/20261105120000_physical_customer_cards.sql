-- Tarjeta física de cliente (tarea 0m4h4mjmm, proyecto j36831miv).
-- Plan: 04 Execution/plans/Tarjeta física de cliente.md (vault).
-- Decisión: 00 Vision & Estrategia/Decisiones/Tarjeta física de cliente por
-- negocio, neutra en la mecánica.md (vault).
--
-- El cliente puede traer en la cartera una tarjeta impresa con el QR
-- https://vichente.com/t/{token}. La digital es la tarjeta; la física es un
-- accesorio que se le asocia: el dueño escanea cualquiera de las dos y llega al
-- mismo cliente, con los mismos sellos.
--
-- Tres piezas:
--   1. La identidad del cliente se separa de los sellos. `stamp_card_holders`
--      pasa a `business_customers` y `holder_id` a `customer_id`. La tarjeta
--      física no habla de sellos, así que el cliente en un negocio tampoco: una
--      segunda mecánica se cuelga de `business_customers` sin rehacerla. Las
--      tablas de sellos conservan su nombre porque esas sí son la mecánica. En
--      prod no había filas (2026-11-05), así que renombrar no mueve datos.
--   2. `physical_cards`: la tarjeta impresa. Nace ligada a su negocio cuando el
--      admin genera la hoja, y al cliente cuando él la escanea con su celular.
--      Una sola física vigente por cliente: asociar otra revoca la anterior.
--   3. `resolve_customer_token()`: la única definición de «este token lleva a
--      este cliente». La usan la landing y el dueño, así que una física
--      revocada deja de servir en todos lados a la vez.
--
-- Autorización igual que en 20261103120000_stamp_cards: anon y owner no tienen
-- ningún grant sobre las tablas; todo pasa por funciones security definer.
-- Generar físicas es solo de admin (is_admin()), y nadie las puede listar salvo
-- el admin, porque el token es un secreto al portador.
--
-- Trampa: renombrar una tabla no reescribe los cuerpos de las funciones. Por eso
-- se recrean aquí TODAS las que nombraban stamp_card_holders o holder_id, aunque
-- su comportamiento no cambie.

-- ============================================================
-- 1. La identidad del cliente, separada de la mecánica
-- ============================================================

alter table public.stamp_card_holders rename to business_customers;
alter table public.business_customers
  rename constraint stamp_card_holders_pkey to business_customers_pkey;
alter table public.business_customers
  rename constraint stamp_card_holders_token_key to business_customers_token_key;
alter table public.business_customers
  rename constraint stamp_card_holders_business_id_fkey to business_customers_business_id_fkey;
alter table public.business_customers
  rename constraint stamp_card_holders_device_id_length to business_customers_device_id_length;
alter index public.stamp_card_holders_business_device_key
  rename to business_customers_business_device_key;
alter policy "admin reads stamp card holders" on public.business_customers
  rename to "admin reads business customers";

-- Para la FK compuesta de physical_cards: una física solo puede quedar asociada
-- a un cliente de SU negocio, aunque una función tenga un bug.
alter table public.business_customers
  add constraint business_customers_id_business_key unique (id, business_id);

comment on table public.business_customers is
  'El cliente en un negocio, sin cuenta y sin importar la mecánica. Hoy lo usa la tarjeta de sellos; una mecánica nueva se cuelga de aquí. Anon no tiene grants: obtiene y lee su tarjeta por token vía funciones. El dueño llega a él por su token o por el de su tarjeta física (resolve_customer_token). Solo el admin lee la tabla (el token es secreto al portador).';
comment on column public.business_customers.token is
  'Secreto del link y del QR de la tarjeta digital. No cambia nunca, ni al canjear ni al asociar una física.';
comment on column public.business_customers.device_id is
  'device_id de la landing (localStorage). Sostiene un cliente por celular y negocio; se acepta que borrar el navegador lo salta. NO es secreto: nunca basta para llegar al cliente.';

alter table public.stamp_cards rename column holder_id to customer_id;
alter table public.stamp_cards
  rename constraint stamp_cards_holder_id_fkey to stamp_cards_customer_id_fkey;
alter table public.stamp_cards
  rename constraint stamp_cards_id_holder_key to stamp_cards_id_customer_key;
alter index public.stamp_cards_one_open_per_holder rename to stamp_cards_one_open_per_customer;
alter index public.stamp_cards_holder_created_idx rename to stamp_cards_customer_created_idx;

alter table public.stamp_card_stamps rename column holder_id to customer_id;
alter table public.stamp_card_stamps
  rename constraint stamp_card_stamps_card_holder_fkey to stamp_card_stamps_card_customer_fkey;
alter index public.stamp_card_stamps_holder_day_key rename to stamp_card_stamps_customer_day_key;

comment on column public.stamp_card_stamps.customer_id is
  'Repetido de la vuelta para que «uno por día» valga por cliente y no por vuelta. Como el cliente es el mismo con la tarjeta digital o con la física, el límite cuenta igual por las dos.';

-- ============================================================
-- 2. La tarjeta física
-- ============================================================

create table public.physical_cards (
  id          uuid primary key default gen_random_uuid(),
  -- Va impreso en el QR (https://vichente.com/t/{token}) y no se puede rotar:
  -- mismo generador que business_customers.token, 144 bits.
  token       text not null unique default translate(
                encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'
              ),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid,
  linked_at   timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  -- Las de una misma hoja comparten created_at (el now() de la transacción que
  -- las generó): (business_id, created_at) identifica la hoja, sin tabla de lotes.
  created_at  timestamptz not null default now(),
  -- Con customer_id null la FK no se evalúa (MATCH SIMPLE): la física sin
  -- asociar solo necesita su negocio. Si se borra el cliente se borra su física,
  -- en vez de quedar suelta para que otro la asocie.
  constraint physical_cards_customer_fkey
    foreign key (customer_id, business_id)
    references public.business_customers (id, business_id) on delete cascade,
  constraint physical_cards_linked_consistent
    check ((customer_id is null) = (linked_at is null)),
  constraint physical_cards_revoked_after_created
    check (revoked_at is null or revoked_at >= created_at)
);

-- Una sola física vigente por cliente, aunque lleguen dos asociaciones a la vez.
create unique index physical_cards_one_active_per_customer
  on public.physical_cards (customer_id)
  where customer_id is not null and revoked_at is null;
create index physical_cards_business_created_idx
  on public.physical_cards (business_id, created_at);

comment on table public.physical_cards is
  'Tarjeta física impresa de un cliente en un negocio. Nace ligada al negocio cuando el admin genera la hoja (admin_create_physical_cards) y al cliente cuando él la escanea con su celular (link_physical_card). Sin asociar no se puede sellar. Una sola vigente por cliente: asociar otra revoca la anterior. Solo el admin lee la tabla.';
comment on column public.physical_cards.token is
  'Secreto del QR impreso (https://vichente.com/t/{token}). No se imprime como texto y no se puede rotar.';
comment on column public.physical_cards.customer_id is
  'Cliente al que se asoció. Null = sin asociar. Una vez puesto no cambia: reasignar a otro cliente no existe.';
comment on column public.physical_cards.revoked_at is
  'Cuándo dejó de servir: la reemplazó otra física del mismo cliente o se anuló la hoja. Revocada, se comporta como un token que no existe.';
comment on column public.physical_cards.created_by is
  'Admin que generó la hoja.';

alter table public.physical_cards enable row level security;
revoke all on public.physical_cards from anon, authenticated;
grant select on public.physical_cards to authenticated;
create policy "admin reads physical cards"
  on public.physical_cards for select to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. Slug reservado para la ruta del QR impreso
-- ============================================================

-- La landing sirve /t/{token} y [slug] chocaría con un negocio cuyo slug fuera
-- `t`. Mismo blocklist que 20260904140000_reserve_buscar_slug más 't'.
create or replace function public.slug_is_reserved(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate = any (array[
    -- rutas / infra del sitio
    'legal', 'support', 'negocio', 'api', 'admin', 'www', 'app',
    'about', 'privacy', 'terms', '_next', 'static', 'public', 'assets',
    'favicon', 'robots', 'sitemap',
    -- reservados de producto
    'index', 'home', 'contact', 'help', 'login', 'signup', 'register',
    'registrar-negocio', 'business', 'search', 'explorar', 'vichente',
    -- rutas raíz de los tabs de la app mobile
    'negocios', 'comida',
    -- rutas estáticas top-level de un solo segmento en app_router.dart
    'splash', 'favoritos', 'filtro', 'omnibus-schedule',
    -- raíz de los resultados de búsqueda compartibles (landing: src/app/buscar/)
    'buscar',
    -- QR de la tarjeta física de cliente (landing: src/app/t/[token]/)
    't'
  ]);
$$;

-- ============================================================
-- 4. Funciones internas
-- ============================================================

-- Del token al cliente. Busca primero en la digital y después en las físicas
-- vigentes. `linked` es false solo para una física sin asociar (customer_id
-- null). Una física revocada y un token que no existe regresan lo mismo: nada.
create or replace function public.resolve_customer_token(p_token text)
returns table (
  customer_id uuid,
  business_id uuid,
  linked      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select bc.id, bc.business_id, true
      from public.business_customers bc
     where bc.token = p_token
    union all
    select pc.customer_id, pc.business_id, pc.customer_id is not null
      from public.physical_cards pc
     where pc.token = p_token
       and pc.revoked_at is null
  )
  limit 1
$$;

comment on function public.resolve_customer_token(text) is
  'Interna. Del token de una tarjeta digital o física al cliente y su negocio. linked = false para una física sin asociar. Física revocada o token inexistente: sin filas. Es la única definición de qué token lleva a qué cliente.';

-- Cambia el nombre del parámetro: create or replace no lo permite.
drop function public.stamp_card_open_card(uuid);
create function public.stamp_card_open_card(p_customer_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_card_id uuid;
begin
  select c.id into v_card_id
    from public.stamp_cards c
   where c.customer_id = p_customer_id
     and c.redeemed_at is null;

  if v_card_id is not null then
    return v_card_id;
  end if;

  insert into public.stamp_cards (customer_id, stamps_required, reward)
  select bc.id, b.stamp_card_stamps_required, b.stamp_card_reward
    from public.business_customers bc
    join public.businesses b on b.id = bc.business_id
   where bc.id = p_customer_id
     and b.is_active
     and b.stamp_card_active
  on conflict (customer_id) where redeemed_at is null do nothing
  returning id into v_card_id;

  -- Perdió la carrera contra otra llamada: la vuelta ya existe.
  if v_card_id is null then
    select c.id into v_card_id
      from public.stamp_cards c
     where c.customer_id = p_customer_id
       and c.redeemed_at is null;
  end if;

  return v_card_id;
end;
$$;

comment on function public.stamp_card_open_card(uuid) is
  'Interna. Devuelve la vuelta abierta del cliente; si no tiene y el programa del negocio está prendido, la abre con la configuración vigente. Null si no hay y no se puede abrir.';

-- Lo que ve el dueño en caja, por cliente. Antes vivía dentro de
-- owner_get_stamp_card(token); con dos tokens por cliente, las funciones que
-- terminan devolviendo el estado lo piden por cliente. No revisa permisos: la
-- llaman funciones que ya revisaron is_owner_of().
create or replace function public.stamp_card_owner_state(p_customer_id uuid)
returns table (
  card_id          uuid,
  business_id      uuid,
  business_name    text,
  program_active   boolean,
  reward           text,
  stamps_required  integer,
  stamps           integer,
  is_full          boolean,
  stamped_today    boolean,
  last_redeemed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    oc.id,
    b.id,
    b.name,
    (b.is_active and b.stamp_card_active),
    coalesce(oc.reward, b.stamp_card_reward),
    coalesce(oc.stamps_required, b.stamp_card_stamps_required),
    coalesce(st.n, 0)::integer,
    coalesce(st.n >= oc.stamps_required, false),
    exists (
      select 1
        from public.stamp_card_stamps s
       where s.customer_id = bc.id
         and s.stamp_day = (now() at time zone 'America/Mexico_City')::date
    ),
    (
      select max(c.redeemed_at)
        from public.stamp_cards c
       where c.customer_id = bc.id
    )
  from public.business_customers bc
  join public.businesses b on b.id = bc.business_id
  left join public.stamp_cards oc
    on oc.customer_id = bc.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  where bc.id = p_customer_id
$$;

comment on function public.stamp_card_owner_state(uuid) is
  'Interna. Estado de la tarjeta de sellos de un cliente para el panel del dueño: vuelta abierta (card_id null si no hay), si está llena y si ya recibió el sello de hoy. No revisa permisos.';

-- ============================================================
-- 5. Funciones para la landing (anon)
-- ============================================================

-- QR del mostrador. Misma firma y mismo comportamiento que antes: solo cambia
-- la tabla donde nace el cliente.
create or replace function public.get_or_create_stamp_card(p_slug text, p_device_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business    public.businesses%rowtype;
  v_device      text := nullif(btrim(p_device_id), '');
  v_customer_id uuid;
  v_token       text;
begin
  if v_device is null or char_length(v_device) > 100 then
    raise exception 'invalid_device_id' using errcode = '22023';
  end if;

  select * into v_business
    from public.businesses b
   where b.slug = p_slug;

  if not found or not v_business.is_active or not v_business.stamp_card_active then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;

  insert into public.business_customers (business_id, device_id)
  values (v_business.id, v_device)
  on conflict (business_id, device_id) do nothing
  returning id, token into v_customer_id, v_token;

  if v_customer_id is null then
    raise exception 'already_has_card' using errcode = 'P0001';
  end if;

  perform public.stamp_card_open_card(v_customer_id);

  return v_token;
end;
$$;

-- Estado de la tarjeta por token: el de la digital o el de una física asociada
-- y vigente. Física sin asociar, revocada o token inexistente: sin filas.
create or replace function public.get_stamp_card(p_token text)
returns table (
  business_name       text,
  business_slug       text,
  program_active      boolean,
  reward              text,
  stamps_required     integer,
  stamps              integer,
  is_full             boolean,
  last_stamp_at       timestamptz,
  last_redeemed_at    timestamptz,
  last_redeemed_reward text,
  server_now          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.name,
    b.slug,
    (b.is_active and b.stamp_card_active),
    coalesce(oc.reward, b.stamp_card_reward),
    coalesce(oc.stamps_required, b.stamp_card_stamps_required),
    coalesce(st.n, 0)::integer,
    coalesce(st.n >= oc.stamps_required, false),
    st.last_at,
    lr.redeemed_at,
    lr.reward,
    now()
  from public.resolve_customer_token(p_token) r
  join public.business_customers bc on bc.id = r.customer_id
  join public.businesses b on b.id = bc.business_id
  left join public.stamp_cards oc
    on oc.customer_id = bc.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n, max(s.created_at) as last_at
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  left join lateral (
    select c.redeemed_at, c.reward
      from public.stamp_cards c
     where c.customer_id = bc.id
       and c.redeemed_at is not null
     order by c.redeemed_at desc
     limit 1
  ) lr on true
  where r.linked
$$;

comment on function public.get_stamp_card(text) is
  'Estado de una tarjeta de sellos por el token de la digital o de una física asociada y vigente: negocio, si el programa sigue prendido, premio y sellos de la vuelta abierta, si está llena, último sello y último canje. Sin token válido no devuelve filas.';

-- Lo que necesita la página /t/{token} para decidir a dónde mandar:
--   - `unlinked`: física sin asociar → asociarla con link_physical_card;
--   - `linked`: la tarjeta del cliente, en la mecánica que diga active_mechanic;
--   - active_mechanic null: el negocio no tiene nada activo → su ficha (slug).
-- Física revocada o token inexistente: sin filas. Regresar el negocio de una
-- física sin asociar no es fuga: el nombre ya va impreso en la tarjeta.
create or replace function public.get_card_entry(p_token text)
returns table (
  status          text,
  business_name   text,
  business_slug   text,
  active_mechanic text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when r.linked then 'linked' else 'unlinked' end,
    b.name,
    b.slug,
    case when b.is_active and b.stamp_card_active then 'stamp_card' end
  from public.resolve_customer_token(p_token) r
  join public.businesses b on b.id = r.business_id
$$;

comment on function public.get_card_entry(text) is
  'Entrada de la ruta /t/{token}: si la tarjeta está sin asociar (unlinked) o asociada (linked), el negocio y la mecánica activa (stamp_card, o null si no tiene nada activo y toca mandar a la ficha). Física revocada o token inexistente: sin filas.';

-- Asocia una física al cliente que la escanea. Regla de seguridad: para llegar
-- a un cliente que ya existe hace falta el token de SU digital; el device_id no
-- basta, porque no es secreto (viaja en la telemetría y en localStorage). Si
-- bastara, cualquiera que lo conociera podría colgarle una física suya al
-- cliente de otro, o reemplazarle la suya. Reglas, en orden:
--   - física inexistente o revocada: `not_a_card`;
--   - negocio inactivo: `card_not_available`;
--   - p_customer_token que no es de ningún cliente: `invalid_customer_token`;
--     de un cliente de otro negocio: `wrong_business`;
--   - física ya asociada al mismo cliente: éxito sin cambios (doble toque);
--     a otro cliente: `card_already_linked`;
--   - con p_customer_token: se revoca la física vigente de ese cliente y se
--     asocia esta;
--   - sin p_customer_token: se crea el cliente con (negocio, device_id) y se
--     asocia en el mismo paso; si ese celular ya tiene cliente en el negocio,
--     `already_has_card` SIN regresar su token, como get_or_create_stamp_card.
-- Abre la vuelta de sellos si el programa está prendido. Regresa el token de la
-- digital para que la landing lo guarde.
create or replace function public.link_physical_card(
  p_token          text,
  p_device_id      text,
  p_customer_token text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_card     public.physical_cards%rowtype;
  v_customer public.business_customers%rowtype;
  v_device   text := nullif(btrim(p_device_id), '');
  v_ctoken   text := nullif(btrim(p_customer_token), '');
begin
  -- La fila bloqueada serializa dos asociaciones de la misma física.
  select * into v_card
    from public.physical_cards pc
   where pc.token = p_token
     and pc.revoked_at is null
     for update;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.businesses b where b.id = v_card.business_id and b.is_active
  ) then
    raise exception 'card_not_available' using errcode = 'P0001';
  end if;

  if v_ctoken is not null then
    -- El cliente bloqueado serializa dos físicas distintas para el mismo
    -- cliente; el índice único parcial respalda.
    select * into v_customer
      from public.business_customers bc
     where bc.token = v_ctoken
       for update;
    if not found then
      raise exception 'invalid_customer_token' using errcode = 'P0001';
    end if;
    if v_customer.business_id <> v_card.business_id then
      raise exception 'wrong_business' using errcode = 'P0001';
    end if;
  end if;

  if v_card.customer_id is not null then
    if v_customer.id is not null and v_card.customer_id = v_customer.id then
      return v_customer.token;
    end if;
    raise exception 'card_already_linked' using errcode = 'P0001';
  end if;

  if v_customer.id is null then
    if v_device is null or char_length(v_device) > 100 then
      raise exception 'invalid_device_id' using errcode = '22023';
    end if;
    insert into public.business_customers (business_id, device_id)
    values (v_card.business_id, v_device)
    on conflict (business_id, device_id) do nothing
    returning * into v_customer;
    if v_customer.id is null then
      raise exception 'already_has_card' using errcode = 'P0001';
    end if;
  else
    -- Primero se revoca la anterior: el índice único parcial no deja dos
    -- vigentes ni por un instante.
    update public.physical_cards pc
       set revoked_at = now()
     where pc.customer_id = v_customer.id
       and pc.revoked_at is null;
  end if;

  update public.physical_cards pc
     set customer_id = v_customer.id,
         linked_at   = now()
   where pc.id = v_card.id;

  perform public.stamp_card_open_card(v_customer.id);

  return v_customer.token;
end;
$$;

comment on function public.link_physical_card(text, text, text) is
  'Asocia una tarjeta física sin asociar al cliente que la escanea y regresa el token de su digital. Con p_customer_token la asocia a ese cliente (mismo negocio) y revoca su física anterior; sin él crea el cliente para ese celular. Errores: not_a_card, card_not_available, invalid_customer_token, wrong_business, card_already_linked, already_has_card, invalid_device_id.';

-- ============================================================
-- 6. Funciones del dueño (owner)
-- ============================================================

-- Tarjeta por token (digital o física) para la pantalla de caja. Errores, en
-- orden:
--   - `not_a_card`: el token no es de ninguna tarjeta, o es de una física
--     revocada;
--   - `not_your_business`: es de otro negocio, sin decir de quién, asociada o no;
--   - `card_not_linked`: física de su negocio que el cliente todavía no asocia;
--     el panel le pide al dueño que el cliente la escanee con su celular.
create or replace function public.owner_get_stamp_card(p_token text)
returns table (
  card_id          uuid,
  business_id      uuid,
  business_name    text,
  program_active   boolean,
  reward           text,
  stamps_required  integer,
  stamps           integer,
  is_full          boolean,
  stamped_today    boolean,
  last_redeemed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_ref record;
begin
  select * into v_ref from public.resolve_customer_token(p_token);

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not public.is_owner_of(v_ref.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  if not v_ref.linked then
    raise exception 'card_not_linked' using errcode = 'P0001';
  end if;

  return query select * from public.stamp_card_owner_state(v_ref.customer_id);
end;
$$;

comment on function public.owner_get_stamp_card(text) is
  'Tarjeta de sellos por el token de la digital o de la física, para el panel del dueño. Errores: not_a_card (token inexistente o física revocada), not_your_business, card_not_linked (física de su negocio sin asociar). Devuelve la vuelta abierta (card_id null si no hay), si está llena y si ya recibió el sello de hoy.';

-- Da un sello. Mismos errores que owner_get_stamp_card, y luego:
--   - programa apagado o negocio inactivo: `stamp_card_not_available`;
--   - ya recibió sello hoy (hora de Durango): `already_stamped_today`;
--   - vuelta llena: `card_full`.
-- El sello va contra el cliente: con la digital o con la física cuenta igual.
create or replace function public.owner_add_stamp(p_token text)
returns table (
  card_id          uuid,
  business_id      uuid,
  business_name    text,
  program_active   boolean,
  reward           text,
  stamps_required  integer,
  stamps           integer,
  is_full          boolean,
  stamped_today    boolean,
  last_redeemed_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_ref      record;
  v_card     public.stamp_cards%rowtype;
  v_card_id  uuid;
  v_today    date := (now() at time zone 'America/Mexico_City')::date;
  v_stamps   integer;
begin
  select * into v_ref from public.resolve_customer_token(p_token);

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not public.is_owner_of(v_ref.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  if not v_ref.linked then
    raise exception 'card_not_linked' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from public.businesses b
     where b.id = v_ref.business_id
       and b.is_active
       and b.stamp_card_active
  ) then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;

  v_card_id := public.stamp_card_open_card(v_ref.customer_id);
  if v_card_id is null then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;

  select * into v_card
    from public.stamp_cards c
   where c.id = v_card_id
     for update;

  if exists (
    select 1
      from public.stamp_card_stamps s
     where s.customer_id = v_ref.customer_id
       and s.stamp_day = v_today
  ) then
    raise exception 'already_stamped_today' using errcode = 'P0001';
  end if;

  select count(*) into v_stamps
    from public.stamp_card_stamps s
   where s.card_id = v_card.id;

  if v_stamps >= v_card.stamps_required then
    raise exception 'card_full' using errcode = 'P0001';
  end if;

  -- El índice único (customer_id, stamp_day) decide si dos escaneos llegan juntos.
  begin
    insert into public.stamp_card_stamps (card_id, customer_id, stamp_day, stamped_by)
    values (v_card.id, v_ref.customer_id, v_today, auth.uid());
  exception when unique_violation then
    raise exception 'already_stamped_today' using errcode = 'P0001';
  end;

  return query select * from public.stamp_card_owner_state(v_ref.customer_id);
end;
$$;

comment on function public.owner_add_stamp(text) is
  'Da un sello a la tarjeta del token (digital o física asociada) si es de un negocio del dueño. Uno por cliente y día (hora de Durango), sin importar con qué tarjeta. Errores: not_a_card, not_your_business, card_not_linked, stamp_card_not_available, already_stamped_today, card_full. Devuelve el estado después del sello.';

-- Canjea el premio de una vuelta. Recibe la vuelta y no el token, igual que
-- antes; el card_id solo se obtiene de owner_get_stamp_card / owner_add_stamp,
-- que ya rechazan una física revocada. Reglas sin cambio: not_a_card,
-- not_your_business, already_redeemed, card_not_full.
create or replace function public.owner_redeem_stamp_card(p_card_id uuid)
returns table (
  card_id          uuid,
  business_id      uuid,
  business_name    text,
  program_active   boolean,
  reward           text,
  stamps_required  integer,
  stamps           integer,
  is_full          boolean,
  stamped_today    boolean,
  last_redeemed_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_card     public.stamp_cards%rowtype;
  v_customer public.business_customers%rowtype;
  v_stamps   integer;
begin
  select * into v_card
    from public.stamp_cards c
   where c.id = p_card_id
     for update;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;

  select * into v_customer
    from public.business_customers bc
   where bc.id = v_card.customer_id;

  if not public.is_owner_of(v_customer.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  if v_card.redeemed_at is not null then
    raise exception 'already_redeemed' using errcode = 'P0001';
  end if;

  select count(*) into v_stamps
    from public.stamp_card_stamps s
   where s.card_id = v_card.id;

  if v_stamps < v_card.stamps_required then
    raise exception 'card_not_full' using errcode = 'P0001';
  end if;

  update public.stamp_cards c
     set redeemed_at = now(),
         redeemed_by = auth.uid()
   where c.id = v_card.id
     and c.redeemed_at is null;

  perform public.stamp_card_open_card(v_customer.id);

  return query select * from public.stamp_card_owner_state(v_customer.id);
end;
$$;

-- ============================================================
-- 7. Funciones del admin
-- ============================================================

-- Genera las físicas de una hoja y regresa sus tokens para armar el PDF. Solo
-- admin. Una hoja tabloide son 20; el tope de 100 solo frena un error de dedo.
create or replace function public.admin_create_physical_cards(
  p_business_id uuid,
  p_count       integer
)
returns table (token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'permission denied: only admin can create physical cards'
      using errcode = '42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'invalid_count' using errcode = '22023';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;

  return query
  insert into public.physical_cards as pc (business_id, created_by)
  select p_business_id, auth.uid()
    from generate_series(1, p_count)
  returning pc.token;
end;
$$;

comment on function public.admin_create_physical_cards(uuid, integer) is
  'Solo admin. Genera p_count (1 a 100) tarjetas físicas sin asociar para un negocio y regresa sus tokens para el PDF de impresión. Las de una llamada comparten created_at: eso identifica la hoja.';

-- ============================================================
-- 8. Quién ejecuta qué
-- ============================================================

-- Postgres y Supabase dan execute a toda función nueva. Se reescribe completo:
-- la landing (anon, y authenticated por si se usa con sesión) obtiene, lee y
-- asocia su tarjeta; solo authenticated llega a las del dueño y del admin, que
-- además revisan is_owner_of() / is_admin() adentro. Las internas no las
-- ejecuta nadie.
revoke all on function public.resolve_customer_token(text) from public, anon, authenticated;
revoke all on function public.stamp_card_open_card(uuid) from public, anon, authenticated;
revoke all on function public.stamp_card_owner_state(uuid) from public, anon, authenticated;
revoke all on function public.get_or_create_stamp_card(text, text) from public, anon, authenticated;
revoke all on function public.get_stamp_card(text) from public, anon, authenticated;
revoke all on function public.get_card_entry(text) from public, anon, authenticated;
revoke all on function public.link_physical_card(text, text, text) from public, anon, authenticated;
revoke all on function public.owner_get_stamp_card(text) from public, anon, authenticated;
revoke all on function public.owner_add_stamp(text) from public, anon, authenticated;
revoke all on function public.owner_redeem_stamp_card(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_physical_cards(uuid, integer) from public, anon, authenticated;

grant execute on function public.get_or_create_stamp_card(text, text) to anon, authenticated;
grant execute on function public.get_stamp_card(text) to anon, authenticated;
grant execute on function public.get_card_entry(text) to anon, authenticated;
grant execute on function public.link_physical_card(text, text, text) to anon, authenticated;
grant execute on function public.owner_get_stamp_card(text) to authenticated;
grant execute on function public.owner_add_stamp(text) to authenticated;
grant execute on function public.owner_redeem_stamp_card(uuid) to authenticated;
grant execute on function public.admin_create_physical_cards(uuid, integer) to authenticated;
