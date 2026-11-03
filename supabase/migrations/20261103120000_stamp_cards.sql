-- Tarjeta de sellos: primera versión de Vichente Rewards (tarea dewabsacd,
-- proyecto j36831miv). Plan: 04 Execution/plans/Tarjeta de sellos.md (vault).
--
-- El cliente escanea el QR del mostrador y le queda su tarjeta en un link de la
-- landing, sin cuenta. En caja, el dueño (rol `owner`) escanea el QR de esa
-- tarjeta desde su panel y le da un sello: uno por compra o visita, sin importar
-- el monto, y como máximo uno por día. Cuando la tarjeta se llena, el dueño
-- canjea el premio. El premio lo decide y lo paga el negocio.
--
-- Cuatro piezas:
--   1. Configuración en `businesses` (interruptor, sellos que llenan la tarjeta,
--      premio). Solo la cambia un admin, igual que feedback_reward_*.
--   2. `stamp_card_holders`: el cliente en un negocio. Su token es el QR de la
--      tarjeta y NO cambia nunca, ni al canjear (decisión del usuario,
--      2026-11-03): el link guardado y el QR que conoce el dueño siguen sirviendo.
--   3. `stamp_cards`: una vuelta de la tarjeta. Guarda su propia copia de sellos
--      y premio: si el admin cambia la configuración, las tarjetas a medias
--      conservan lo que tenían y el cambio aplica desde la vuelta siguiente
--      (decisión del usuario, 2026-11-03).
--   4. `stamp_card_stamps`: los sellos, uno por cliente y día.
--
-- No se reusa `coupons`: ese lo canjea el cliente con su token, vence y es uno
-- por celular para siempre. Aquí canjea el dueño, el premio no vence y se repite
-- cada vez que la tarjeta se llena.
--
-- Autorización, igual que los cupones (20261010130000) y el panel del dueño
-- (20261022120000): anon y owner NO tienen ningún grant sobre las tablas nuevas.
-- Todo pasa por funciones security definer con las reglas en un solo lugar.
-- Es la primera escritura de un `owner`, y se queda dentro de estas funciones:
-- no gana ninguna policy ni grant sobre ninguna tabla. La única definición de
-- "este negocio es suyo" sigue siendo is_owner_of().

-- ============================================================
-- 1. Configuración por negocio
-- ============================================================

-- Legibles por anon (businesses no tiene grants por columna). Está bien: el
-- interruptor, los sellos y el premio son públicos, la landing los muestra.
-- Sin default en sellos ni premio: el número y el premio los elige cada dueño, y
-- un default inventado terminaría impreso en una tarjeta.
alter table public.businesses
  add column stamp_card_active boolean not null default false,
  add column stamp_card_stamps_required integer,
  add column stamp_card_reward text,
  add constraint businesses_stamp_card_stamps_required_range
    check (stamp_card_stamps_required is null or stamp_card_stamps_required between 2 and 20),
  add constraint businesses_stamp_card_reward_length
    check (stamp_card_reward is null or char_length(stamp_card_reward) between 1 and 40),
  add constraint businesses_stamp_card_active_needs_config
    check (
      not stamp_card_active
      or (
        stamp_card_stamps_required is not null
        and nullif(btrim(stamp_card_reward), '') is not null
      )
    );

comment on column public.businesses.stamp_card_active is
  'Interruptor de la tarjeta de sellos. Apagado (o el negocio inactivo), no se crean tarjetas ni se dan sellos; un premio ya ganado sí se puede canjear. Solo lo cambia un admin (trigger).';
comment on column public.businesses.stamp_card_stamps_required is
  'Sellos que llenan la tarjeta (2 a 20). Cada vuelta guarda su copia al crearse: un cambio aplica desde la vuelta siguiente. Solo lo cambia un admin (trigger).';
comment on column public.businesses.stamp_card_reward is
  'Premio que eligió el dueño, sin artículo ("frappé"): la tarjeta dice "para tu {premio}". Cada vuelta guarda su copia. Solo lo cambia un admin (trigger).';

-- El dueño no edita la configuración: la captura el admin. La RLS de businesses
-- deja al reviewer editar los negocios de su municipio y acota FILAS, no
-- columnas: el trigger es la barrera de columna. Mismo patrón que
-- guard_business_feedback_reward_admin (sin excepción para service_role).
create or replace function public.guard_business_stamp_card_admin()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if (
    (
      tg_op = 'INSERT'
      and (
        new.stamp_card_active
        or new.stamp_card_stamps_required is not null
        or new.stamp_card_reward is not null
      )
    )
    or (
      tg_op = 'UPDATE'
      and (
        old.stamp_card_active is distinct from new.stamp_card_active
        or old.stamp_card_stamps_required is distinct from new.stamp_card_stamps_required
        or old.stamp_card_reward is distinct from new.stamp_card_reward
      )
    )
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.stamp_card_*'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke execute on function public.guard_business_stamp_card_admin() from public;

drop trigger if exists businesses_stamp_card_admin_only on public.businesses;
create trigger businesses_stamp_card_admin_only
before insert or update of stamp_card_active, stamp_card_stamps_required, stamp_card_reward
on public.businesses
for each row execute function public.guard_business_stamp_card_admin();

comment on function public.guard_business_stamp_card_admin() is
  'Impide que cualquier identidad de aplicación distinta de admin cambie la configuración de la tarjeta de sellos. Solo exceptúa postgres para operación de infraestructura.';

-- ============================================================
-- 2. Tablas
-- ============================================================

create table public.stamp_card_holders (
  id          uuid primary key default gen_random_uuid(),
  -- El QR de la tarjeta lleva este token. 18 bytes aleatorios en base64url:
  -- 24 caracteres, 144 bits. No se puede adivinar ni recorrer.
  token       text not null unique default translate(
                encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'
              ),
  business_id uuid not null references public.businesses(id) on delete cascade,
  device_id   text not null,
  created_at  timestamptz not null default now(),
  constraint stamp_card_holders_device_id_length check (char_length(device_id) between 1 and 100)
);

-- Una tarjeta por celular y negocio. Solo frena el doble toque: el device_id
-- vive en localStorage junto al token, así que borrar el navegador da otra.
create unique index stamp_card_holders_business_device_key
  on public.stamp_card_holders (business_id, device_id);

comment on table public.stamp_card_holders is
  'Cliente de la tarjeta de sellos en un negocio, sin cuenta. Anon no tiene grants: obtiene su tarjeta y la lee por su token vía get_or_create_stamp_card / get_stamp_card. El dueño la ve y la sella por token vía owner_*. Solo el admin lee la tabla (el token es secreto al portador).';
comment on column public.stamp_card_holders.token is
  'Secreto del link y del QR de la tarjeta. No cambia al canjear: cada vuelta es una fila de stamp_cards.';
comment on column public.stamp_card_holders.device_id is
  'device_id de la landing (localStorage). Sostiene una tarjeta por celular y negocio; se acepta que borrar el navegador la salta.';

create table public.stamp_cards (
  id               uuid primary key default gen_random_uuid(),
  holder_id        uuid not null references public.stamp_card_holders(id) on delete cascade,
  -- Copia de la configuración al crearse la vuelta: lo prometido no cambia.
  stamps_required  integer not null,
  reward           text not null,
  redeemed_at      timestamptz,
  redeemed_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint stamp_cards_stamps_required_range check (stamps_required between 2 and 20),
  constraint stamp_cards_reward_length check (char_length(reward) between 1 and 40),
  constraint stamp_cards_redeemed_by_needs_redeemed_at
    check (redeemed_by is null or redeemed_at is not null),
  constraint stamp_cards_redeemed_after_created
    check (redeemed_at is null or redeemed_at >= created_at),
  -- Para la FK compuesta de los sellos.
  constraint stamp_cards_id_holder_key unique (id, holder_id)
);

-- Una sola vuelta abierta (sin canjear) por cliente.
create unique index stamp_cards_one_open_per_holder
  on public.stamp_cards (holder_id) where redeemed_at is null;
create index stamp_cards_holder_created_idx
  on public.stamp_cards (holder_id, created_at desc);

comment on table public.stamp_cards is
  'Una vuelta de la tarjeta de sellos. Se llena con stamps_required sellos y se canjea una sola vez (redeemed_at). Al canjear, si el programa sigue prendido, se abre la vuelta siguiente con la configuración vigente.';
comment on column public.stamp_cards.stamps_required is
  'Copia de businesses.stamp_card_stamps_required al abrirse la vuelta.';
comment on column public.stamp_cards.reward is
  'Copia de businesses.stamp_card_reward al abrirse la vuelta.';
comment on column public.stamp_cards.redeemed_at is
  'Cuándo el dueño entregó el premio. Null = vuelta abierta. Se marca una sola vez, vía owner_redeem_stamp_card.';
comment on column public.stamp_cards.redeemed_by is
  'Cuenta que canjeó el premio.';

create table public.stamp_card_stamps (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null,
  -- Repetido de la vuelta para que "uno por día" valga por cliente y no por
  -- vuelta: el sello que llena la tarjeta y el canje van en la misma visita, y
  -- la vuelta nueva no debe recibir otro sello ese mismo día.
  holder_id   uuid not null,
  -- Día calendario en hora de Durango, el mismo huso que coupons.
  stamp_day   date not null,
  stamped_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint stamp_card_stamps_card_holder_fkey
    foreign key (card_id, holder_id)
    references public.stamp_cards (id, holder_id) on delete cascade
);

-- Un sello por cliente y día. Dos escaneos simultáneos: el índice decide.
create unique index stamp_card_stamps_holder_day_key
  on public.stamp_card_stamps (holder_id, stamp_day);
create index stamp_card_stamps_card_idx
  on public.stamp_card_stamps (card_id);

comment on table public.stamp_card_stamps is
  'Un sello en una vuelta de la tarjeta. Uno por cliente y día (hora de Durango), sostenido por índice único. Solo lo crea owner_add_stamp.';
comment on column public.stamp_card_stamps.stamped_by is
  'Cuenta del dueño que dio el sello. Rastro para revisar abusos (sellos regalados a costa del negocio).';

-- Supabase hereda grants amplios por default privileges. Se dejan solo los que
-- hacen falta: el admin lee, nadie de la aplicación escribe directo. Solo admin
-- y no todo el staff, igual que coupons: el token es un secreto al portador.
alter table public.stamp_card_holders enable row level security;
alter table public.stamp_cards enable row level security;
alter table public.stamp_card_stamps enable row level security;

revoke all on public.stamp_card_holders from anon, authenticated;
revoke all on public.stamp_cards from anon, authenticated;
revoke all on public.stamp_card_stamps from anon, authenticated;
grant select on public.stamp_card_holders to authenticated;
grant select on public.stamp_cards to authenticated;
grant select on public.stamp_card_stamps to authenticated;

create policy "admin reads stamp card holders"
  on public.stamp_card_holders for select to authenticated
  using (public.is_admin());
create policy "admin reads stamp cards"
  on public.stamp_cards for select to authenticated
  using (public.is_admin());
create policy "admin reads stamp card stamps"
  on public.stamp_card_stamps for select to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. Funciones internas
-- ============================================================

-- Abre la vuelta del cliente si no tiene una y el programa está prendido, con la
-- configuración vigente. Devuelve la vuelta abierta, o null si no hay y no se
-- puede abrir. Nadie la ejecuta directo: solo las funciones de abajo.
create or replace function public.stamp_card_open_card(p_holder_id uuid)
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
   where c.holder_id = p_holder_id
     and c.redeemed_at is null;

  if v_card_id is not null then
    return v_card_id;
  end if;

  insert into public.stamp_cards (holder_id, stamps_required, reward)
  select h.id, b.stamp_card_stamps_required, b.stamp_card_reward
    from public.stamp_card_holders h
    join public.businesses b on b.id = h.business_id
   where h.id = p_holder_id
     and b.is_active
     and b.stamp_card_active
  on conflict (holder_id) where redeemed_at is null do nothing
  returning id into v_card_id;

  -- Perdió la carrera contra otra llamada: la vuelta ya existe.
  if v_card_id is null then
    select c.id into v_card_id
      from public.stamp_cards c
     where c.holder_id = p_holder_id
       and c.redeemed_at is null;
  end if;

  return v_card_id;
end;
$$;

comment on function public.stamp_card_open_card(uuid) is
  'Interna. Devuelve la vuelta abierta del cliente; si no tiene y el programa del negocio está prendido, la abre con la configuración vigente. Null si no hay y no se puede abrir.';

-- ============================================================
-- 4. Funciones para la landing (anon)
-- ============================================================

-- Crea la tarjeta del cliente y devuelve su token. Reglas:
--   - el negocio existe, está activo y tiene el programa prendido; si no, error
--     `stamp_card_not_available`;
--   - si ese device ya tiene tarjeta en ese negocio, error `already_has_card` y
--     NO devuelve el token existente: el device_id no es un secreto (viaja en la
--     telemetría), y devolverlo lo volvería una segunda llave de la tarjeta.
--     Reescanear cae en la tarjeta porque la landing guarda el token en
--     localStorage, igual que submit_business_feedback.
create or replace function public.get_or_create_stamp_card(p_slug text, p_device_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business  public.businesses%rowtype;
  v_device    text := nullif(btrim(p_device_id), '');
  v_holder_id uuid;
  v_token     text;
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

  insert into public.stamp_card_holders (business_id, device_id)
  values (v_business.id, v_device)
  on conflict (business_id, device_id) do nothing
  returning id, token into v_holder_id, v_token;

  if v_holder_id is null then
    raise exception 'already_has_card' using errcode = 'P0001';
  end if;

  perform public.stamp_card_open_card(v_holder_id);

  return v_token;
end;
$$;

comment on function public.get_or_create_stamp_card(text, text) is
  'Crea la tarjeta de sellos de un celular en un negocio y devuelve su token. Error stamp_card_not_available si el negocio no está activo o no tiene el programa prendido; already_has_card si ese celular ya tiene una (no devuelve el token existente).';

-- Estado de la tarjeta por token. Si no hay vuelta abierta (se canjeó con el
-- programa apagado), devuelve la configuración vigente con 0 sellos. Con token
-- inexistente no devuelve filas.
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
  from public.stamp_card_holders h
  join public.businesses b on b.id = h.business_id
  left join public.stamp_cards oc
    on oc.holder_id = h.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n, max(s.created_at) as last_at
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  left join lateral (
    select c.redeemed_at, c.reward
      from public.stamp_cards c
     where c.holder_id = h.id
       and c.redeemed_at is not null
     order by c.redeemed_at desc
     limit 1
  ) lr on true
  where h.token = p_token
$$;

comment on function public.get_stamp_card(text) is
  'Estado de una tarjeta de sellos por su token: negocio, si el programa sigue prendido, premio y sellos de la vuelta abierta, si está llena, último sello y último canje. Sin token válido no devuelve filas.';

-- ============================================================
-- 5. Funciones del dueño (owner)
-- ============================================================

-- Tarjeta por token para la pantalla de caja (D3/D5). Reglas:
--   - token que no es de ninguna tarjeta: error `not_a_card` (E2);
--   - tarjeta de un negocio que no es suyo: error `not_your_business` (E1), sin
--     decir de quién es.
-- Devuelve la vuelta abierta, o card_id null con 0 sellos y la configuración
-- vigente si no hay.
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
  v_holder public.stamp_card_holders%rowtype;
begin
  select * into v_holder
    from public.stamp_card_holders h
   where h.token = p_token;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not public.is_owner_of(v_holder.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;

  return query
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
       where s.holder_id = v_holder.id
         and s.stamp_day = (now() at time zone 'America/Mexico_City')::date
    ),
    (
      select max(c.redeemed_at)
        from public.stamp_cards c
       where c.holder_id = v_holder.id
    )
  from public.businesses b
  left join public.stamp_cards oc
    on oc.holder_id = v_holder.id and oc.redeemed_at is null
  left join lateral (
    select count(*)::integer as n
      from public.stamp_card_stamps s
     where s.card_id = oc.id
  ) st on true
  where b.id = v_holder.business_id;
end;
$$;

comment on function public.owner_get_stamp_card(text) is
  'Tarjeta de sellos por token para el panel del dueño. Error not_a_card si el token no es de ninguna tarjeta, not_your_business si es de un negocio que no es suyo. Devuelve la vuelta abierta (card_id null si no hay), si está llena y si ya recibió el sello de hoy.';

-- Da un sello. Reglas, en orden:
--   - `not_a_card` / `not_your_business` como owner_get_stamp_card;
--   - programa apagado o negocio inactivo: `stamp_card_not_available`;
--   - ya recibió sello hoy (hora de Durango): `already_stamped_today` (E4);
--   - vuelta llena: `card_full` (toca canjear).
-- La vuelta se bloquea (for update) para que dos sellos no la pasen de llena.
-- Devuelve el estado después del sello, con la forma de owner_get_stamp_card.
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
  v_holder   public.stamp_card_holders%rowtype;
  v_card     public.stamp_cards%rowtype;
  v_card_id  uuid;
  v_today    date := (now() at time zone 'America/Mexico_City')::date;
  v_stamps   integer;
begin
  select * into v_holder
    from public.stamp_card_holders h
   where h.token = p_token;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;
  if not public.is_owner_of(v_holder.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from public.businesses b
     where b.id = v_holder.business_id
       and b.is_active
       and b.stamp_card_active
  ) then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;

  v_card_id := public.stamp_card_open_card(v_holder.id);
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
     where s.holder_id = v_holder.id
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

  -- El índice único (holder_id, stamp_day) decide si dos escaneos llegan juntos.
  begin
    insert into public.stamp_card_stamps (card_id, holder_id, stamp_day, stamped_by)
    values (v_card.id, v_holder.id, v_today, auth.uid());
  exception when unique_violation then
    raise exception 'already_stamped_today' using errcode = 'P0001';
  end;

  return query select * from public.owner_get_stamp_card(p_token);
end;
$$;

comment on function public.owner_add_stamp(text) is
  'Da un sello a la tarjeta del token si es de un negocio del dueño. Uno por cliente y día (hora de Durango). Errores: not_a_card, not_your_business, stamp_card_not_available, already_stamped_today, card_full. Devuelve el estado después del sello.';

-- Canjea el premio de una vuelta. Recibe la vuelta (card_id de
-- owner_get_stamp_card) y no el token, para que un doble toque sobre la
-- confirmación responda `already_redeemed` (E3) en vez de caer en la vuelta
-- nueva. Reglas:
--   - vuelta inexistente: `not_a_card`;
--   - de un negocio que no es suyo: `not_your_business`;
--   - ya canjeada: `already_redeemed`;
--   - sin llenar: `card_not_full`.
-- Se canjea aunque el programa esté apagado: el premio ya se ganó. Al canjear
-- se abre la vuelta siguiente si el programa sigue prendido. Devuelve el estado
-- de la tarjeta después del canje, con la forma de owner_get_stamp_card.
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
  v_card   public.stamp_cards%rowtype;
  v_holder public.stamp_card_holders%rowtype;
  v_stamps integer;
begin
  select * into v_card
    from public.stamp_cards c
   where c.id = p_card_id
     for update;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;

  select * into v_holder
    from public.stamp_card_holders h
   where h.id = v_card.holder_id;

  if not public.is_owner_of(v_holder.business_id) then
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

  perform public.stamp_card_open_card(v_holder.id);

  return query select * from public.owner_get_stamp_card(v_holder.token);
end;
$$;

comment on function public.owner_redeem_stamp_card(uuid) is
  'Canjea el premio de una vuelta llena de un negocio del dueño, una sola vez, y abre la vuelta siguiente si el programa sigue prendido. Errores: not_a_card, not_your_business, already_redeemed, card_not_full. Devuelve el estado de la tarjeta después del canje.';

-- ============================================================
-- 6. Quién ejecuta qué
-- ============================================================

-- Postgres y Supabase dan execute a toda función nueva. Se deja explícito:
-- la landing (anon, y authenticated por si se usa con sesión) obtiene y lee su
-- tarjeta; solo authenticated llega a las del dueño, que además exigen
-- is_owner_of(). La interna no la ejecuta nadie.
revoke all on function public.stamp_card_open_card(uuid) from public, anon, authenticated;
revoke all on function public.get_or_create_stamp_card(text, text) from public, anon, authenticated;
revoke all on function public.get_stamp_card(text) from public, anon, authenticated;
revoke all on function public.owner_get_stamp_card(text) from public, anon, authenticated;
revoke all on function public.owner_add_stamp(text) from public, anon, authenticated;
revoke all on function public.owner_redeem_stamp_card(uuid) from public, anon, authenticated;

grant execute on function public.get_or_create_stamp_card(text, text) to anon, authenticated;
grant execute on function public.get_stamp_card(text) to anon, authenticated;
grant execute on function public.owner_get_stamp_card(text) to authenticated;
grant execute on function public.owner_add_stamp(text) to authenticated;
grant execute on function public.owner_redeem_stamp_card(uuid) to authenticated;
