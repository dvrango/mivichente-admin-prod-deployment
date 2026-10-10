-- Opiniones con descuento: piloto de K-fféss (tarea valziva7q).
-- Plan: 04 Execution/plans/Opiniones con descuento.md (vault).
--
-- El cliente escanea un QR en el local, deja una opinión privada y recibe un
-- descuento para su siguiente compra. La dueña lo marca usado en caja, en el
-- celular del cliente.
--
-- Tres piezas:
--   1. Configuración en `businesses` (interruptor, beneficio, días de vigencia).
--   2. `coupons`: descuento canjeable GENÉRICO. Hoy solo nace de una opinión,
--      pero el cupón por lote, los referidos y los embajadores (03 Ideas/) usan
--      la misma pieza y solo agregan su valor a `source`.
--   3. `business_feedback`: la opinión, privada, que apunta al cupón que generó.
--
-- No se mezcla con `promo_*` de businesses: eso es texto público que no se canjea.
--
-- Autorización: anon NO tiene ningún grant sobre las tablas nuevas. Todo lo que
-- hace (dejar opinión, leer su descuento, usarlo) pasa por tres funciones
-- security definer con las reglas en un solo lugar. Así, aunque un día alguien
-- agregue una policy de más, anon sigue sin poder listar ni leer filas: le
-- faltaría el grant. Leer "solo mi fila" con RLS por token habría dependido de
-- que la policy quedara bien, y si queda mal no se nota.

-- ============================================================
-- 1. Configuración por negocio
-- ============================================================

-- Legibles por anon (businesses no tiene grants por columna). Está bien: el
-- interruptor y el beneficio son públicos, la landing los muestra.
alter table public.businesses
  add column feedback_reward_active boolean not null default false,
  add column feedback_reward_benefit text,
  add column feedback_reward_days integer not null default 30,
  add constraint businesses_feedback_reward_benefit_length
    check (feedback_reward_benefit is null or char_length(feedback_reward_benefit) between 1 and 40),
  add constraint businesses_feedback_reward_days_range
    check (feedback_reward_days between 1 and 365),
  add constraint businesses_feedback_reward_active_needs_benefit
    check (not feedback_reward_active or nullif(btrim(feedback_reward_benefit), '') is not null);

comment on column public.businesses.feedback_reward_active is
  'Interruptor de "opiniones con descuento". Apagado (o el negocio inactivo), la función submit_business_feedback rechaza opiniones. Solo lo cambia un admin (trigger).';
comment on column public.businesses.feedback_reward_benefit is
  'Qué da el descuento, en texto corto ("10%"). Cada cupón guarda su propia copia al crearse. Solo lo cambia un admin (trigger).';
comment on column public.businesses.feedback_reward_days is
  'Días de vigencia del descuento que se genera al dejar una opinión. El cupón vale hasta el final del día N en hora de Durango. Solo lo cambia un admin (trigger).';

-- Dar un descuento es un acuerdo comercial, igual que aceptar pedidos. La RLS
-- de businesses deja al reviewer editar los negocios de su municipio y acota
-- FILAS, no columnas: el trigger es la barrera de columna. Mismo patrón que
-- guard_business_accepts_orders_admin (sin excepción para service_role).
create or replace function public.guard_business_feedback_reward_admin()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if (
    (
      tg_op = 'INSERT'
      and (
        new.feedback_reward_active
        or new.feedback_reward_benefit is not null
        or new.feedback_reward_days <> 30
      )
    )
    or (
      tg_op = 'UPDATE'
      and (
        old.feedback_reward_active is distinct from new.feedback_reward_active
        or old.feedback_reward_benefit is distinct from new.feedback_reward_benefit
        or old.feedback_reward_days is distinct from new.feedback_reward_days
      )
    )
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.feedback_reward_*'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke execute on function public.guard_business_feedback_reward_admin() from public;

drop trigger if exists businesses_feedback_reward_admin_only on public.businesses;
create trigger businesses_feedback_reward_admin_only
before insert or update of feedback_reward_active, feedback_reward_benefit, feedback_reward_days
on public.businesses
for each row execute function public.guard_business_feedback_reward_admin();

comment on function public.guard_business_feedback_reward_admin() is
  'Impide que cualquier identidad de aplicación distinta de admin cambie la configuración de opiniones con descuento. Solo exceptúa postgres para operación de infraestructura.';

-- ============================================================
-- 2. Cupones (genéricos)
-- ============================================================

create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  -- El link del descuento lleva este token. 18 bytes aleatorios en base64url:
  -- 24 caracteres, 144 bits. No se puede adivinar ni recorrer.
  token       text not null unique default translate(
                encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'
              ),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source      text not null,
  -- Copia del beneficio y del vencimiento al crearse: si el negocio cambia su
  -- configuración, los cupones existentes no cambian.
  benefit     text not null,
  expires_at  timestamptz not null,
  device_id   text,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint coupons_source_check check (source in ('feedback')),
  constraint coupons_benefit_length check (char_length(benefit) between 1 and 40),
  constraint coupons_device_id_length
    check (device_id is null or char_length(device_id) between 1 and 100),
  -- Uno por celular viene de la opinión. Un cupón por lote no tendrá device.
  constraint coupons_feedback_needs_device check (source <> 'feedback' or device_id is not null),
  constraint coupons_redeemed_after_created check (redeemed_at is null or redeemed_at >= created_at)
);

-- Uno por celular y negocio, por origen. Con device_id null (cupón por lote)
-- no aplica: los null no chocan entre sí.
create unique index coupons_business_device_source_key
  on public.coupons (business_id, device_id, source);
create index coupons_business_created_idx
  on public.coupons (business_id, created_at desc);

comment on table public.coupons is
  'Descuento canjeable, genérico. Hoy solo nace de una opinión (source = feedback). Anon no tiene grants: lo lee y lo usa por su token vía get_coupon / redeem_coupon. Solo el admin lee la tabla (el token es secreto al portador).';
comment on column public.coupons.token is
  'Secreto del link del descuento. Quien lo tiene puede ver y usar el cupón; sin él no hay forma de encontrarlo.';
comment on column public.coupons.source is
  'De dónde salió el cupón: feedback (opinión). Cupón por lote, referido o embajador se agregan al check cuando existan.';
comment on column public.coupons.benefit is
  'Copia del beneficio del negocio al crearse ("10%"). No se vuelve a leer de businesses.';
comment on column public.coupons.expires_at is
  'Instante en que deja de valer (exclusivo): inicio del día siguiente al último día válido, en hora de Durango. Se calcula al crearse y no cambia.';
comment on column public.coupons.device_id is
  'device_id de la landing (localStorage) que lo generó. Sostiene la regla de uno por celular; se acepta que borrar el navegador la salta.';
comment on column public.coupons.redeemed_at is
  'Cuándo se usó. Null = sin usar. Se marca una sola vez, vía redeem_coupon.';

alter table public.coupons enable row level security;

-- Supabase hereda grants amplios por default privileges. Se dejan solo los que
-- hacen falta: el admin lee, nadie de la aplicación escribe directo.
-- Solo admin y no todo el staff: el token es un secreto al portador, y quien
-- lee la tabla puede usar cualquier descuento. El reviewer no lo necesita para
-- leer opiniones.
revoke all on public.coupons from anon, authenticated;
grant select on public.coupons to authenticated;

create policy "admin reads coupons"
  on public.coupons
  for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. Opiniones (privadas)
-- ============================================================

create table public.business_feedback (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  coupon_id   uuid not null unique references public.coupons(id) on delete cascade,
  rating      smallint not null,
  liked       text,
  improve     text,
  created_at  timestamptz not null default now(),
  constraint business_feedback_rating_range check (rating between 1 and 5),
  constraint business_feedback_liked_length
    check (liked is null or char_length(liked) between 1 and 1000),
  constraint business_feedback_improve_length
    check (improve is null or char_length(improve) between 1 and 1000)
);

create index business_feedback_business_created_idx
  on public.business_feedback (business_id, created_at desc);

comment on table public.business_feedback is
  'Opinión privada que deja un cliente desde el QR del local. Sin nombre ni teléfono. Solo la lee el staff; anon la crea vía submit_business_feedback y nunca la puede leer. No guarda device_id: ese vive en coupons, que solo lee admin.';
comment on column public.business_feedback.liked is
  'Respuesta opcional a "¿Qué te gustó?".';
comment on column public.business_feedback.improve is
  'Respuesta opcional a "¿Qué mejorarías?".';

alter table public.business_feedback enable row level security;

revoke all on public.business_feedback from anon, authenticated;
grant select on public.business_feedback to authenticated;

create policy "staff reads business feedback"
  on public.business_feedback
  for select
  to authenticated
  using (public.is_staff());

-- ============================================================
-- 4. Funciones para la landing (anon)
-- ============================================================

-- Estado de un cupón por token. Con token inexistente no devuelve filas: no
-- distingue "no existe" de "token mal formado".
create or replace function public.get_coupon(p_token text)
returns table (
  business_name text,
  business_slug text,
  benefit       text,
  status        text,
  valid_until   date,
  expires_at    timestamptz,
  redeemed_at   timestamptz,
  created_at    timestamptz,
  server_now    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.name,
    b.slug,
    c.benefit,
    case
      when c.redeemed_at is not null then 'used'
      when c.expires_at <= now()     then 'expired'
      else                                'valid'
    end,
    ((c.expires_at at time zone 'America/Mexico_City')::date - 1),
    c.expires_at,
    c.redeemed_at,
    c.created_at,
    now()
  from public.coupons c
  join public.businesses b on b.id = c.business_id
  where c.token = p_token
$$;

comment on function public.get_coupon(text) is
  'Estado de un cupón por su token: valid / used / expired, más el negocio, el beneficio, el último día válido (valid_until, hora de Durango) y la hora del servidor. Sin token válido no devuelve filas.';

-- Marca usado. Solo cambia algo si está sin usar y no ha vencido: un segundo
-- intento, o uno sobre un cupón vencido, deja la fila igual. Devuelve el estado
-- después del intento, con la misma forma que get_coupon.
create or replace function public.redeem_coupon(p_token text)
returns table (
  business_name text,
  business_slug text,
  benefit       text,
  status        text,
  valid_until   date,
  expires_at    timestamptz,
  redeemed_at   timestamptz,
  created_at    timestamptz,
  server_now    timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.coupons c
     set redeemed_at = now()
   where c.token = p_token
     and c.redeemed_at is null
     and c.expires_at > now();

  return query select * from public.get_coupon(p_token);
end;
$$;

comment on function public.redeem_coupon(text) is
  'Marca usado el cupón del token, una sola vez y solo si no ha vencido. Devuelve el estado después del intento (misma forma que get_coupon).';

-- Deja una opinión y devuelve el token del descuento. Reglas:
--   - el negocio existe, está activo y tiene el interruptor prendido; si no,
--     error `feedback_not_accepted`;
--   - si ese device ya tiene descuento de opinión en ese negocio, error
--     `already_submitted` y NO guarda otra opinión. No devuelve el token
--     existente: el device_id no es un secreto que se pueda cuidar (viaja en la
--     telemetría), y devolverlo lo volvería una segunda llave del cupón. Reescanear cae en el descuento porque la landing
--     guarda el token en localStorage, no por esta función;
--   - si no, crea cupón y opinión juntos, con copia del beneficio y vencimiento
--     al final del día N en hora de Durango.
-- Los largos y el rango se validan aquí además del check de la tabla, para dar
-- un error legible en vez de un nombre de constraint.
create or replace function public.submit_business_feedback(
  p_slug      text,
  p_device_id text,
  p_rating    integer,
  p_liked     text default null,
  p_improve   text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business  public.businesses%rowtype;
  v_device    text := nullif(btrim(p_device_id), '');
  v_liked     text := nullif(btrim(p_liked), '');
  v_improve   text := nullif(btrim(p_improve), '');
  v_coupon_id uuid;
  v_token     text;
begin
  if v_device is null or char_length(v_device) > 100 then
    raise exception 'invalid_device_id' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if char_length(v_liked) > 1000 or char_length(v_improve) > 1000 then
    raise exception 'text_too_long' using errcode = '22023';
  end if;

  select * into v_business
    from public.businesses b
   where b.slug = p_slug;

  if not found or not v_business.is_active or not v_business.feedback_reward_active then
    raise exception 'feedback_not_accepted' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.coupons c
     where c.business_id = v_business.id
       and c.device_id = v_device
       and c.source = 'feedback'
  ) then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;

  -- Dos envíos simultáneos del mismo device: el índice único decide, y el que
  -- pierde recibe el mismo error sin guardar una segunda opinión.
  insert into public.coupons (business_id, source, benefit, expires_at, device_id)
  values (
    v_business.id,
    'feedback',
    v_business.feedback_reward_benefit,
    (
      ((now() at time zone 'America/Mexico_City')::date + v_business.feedback_reward_days + 1)::timestamp
      at time zone 'America/Mexico_City'
    ),
    v_device
  )
  on conflict (business_id, device_id, source) do nothing
  returning id, token into v_coupon_id, v_token;

  if v_coupon_id is null then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;

  insert into public.business_feedback (business_id, coupon_id, rating, liked, improve)
  values (v_business.id, v_coupon_id, p_rating, v_liked, v_improve);

  return v_token;
end;
$$;

comment on function public.submit_business_feedback(text, text, integer, text, text) is
  'Guarda una opinión y crea su descuento; devuelve el token del descuento. Uno por device y negocio: si ya existe, error already_submitted sin guardar otra opinión ni devolver el token existente. Error feedback_not_accepted si el negocio no está activo o no tiene el interruptor prendido.';

-- Postgres y Supabase dan execute a toda función nueva. Se deja explícito
-- quién las corre: la landing (anon) y, por si se usan con sesión, authenticated.
revoke all on function public.get_coupon(text) from public, anon, authenticated;
revoke all on function public.redeem_coupon(text) from public, anon, authenticated;
revoke all on function public.submit_business_feedback(text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.get_coupon(text) to anon, authenticated;
grant execute on function public.redeem_coupon(text) to anon, authenticated;
grant execute on function public.submit_business_feedback(text, text, integer, text, text)
  to anon, authenticated;

-- ============================================================
-- 5. Canal del QR de opiniones en qr_scans
-- ============================================================

-- Mismo mapeo que 20261010120000_qr_scans_bot_and_channel_map, más `opinion-qr`.
-- El QR impreso es https://vichente.com/k-ffess/opinion?src=opinion-qr: el src
-- es fijo. No hay filas con ese src todavía (el QR no está puesto), así que no
-- hace falta recalcular.
create or replace function public.qr_scan_channel_from_src(p_src text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_src is null               then null
    when p_src like 'share%'         then 'share'
    when p_src like 'menu-qr%'       then 'menu-qr'
    when p_src like 'opinion-qr%'    then 'opinion-qr'
    when p_src like 'sticker%'       then 'sticker'
    when p_src like 'post-ig%'       then 'post-ig'
    when p_src like 'post-fb%'       then 'post-fb'
    when p_src like 'fb-post%'       then 'post-fb'
    when p_src = 'landing-banner'    then 'landing'
    else                                  'otro'
  end
$$;

comment on column public.qr_scans.channel is
  'Canal por el que llegó el scan: menu-qr, opinion-qr, sticker, share, post-ig, post-fb, landing, bot, otro. Lo pone siempre el trigger (ignora el del cliente): bot si el user-agent es de un crawler; si no, lo deriva de `src`.';
