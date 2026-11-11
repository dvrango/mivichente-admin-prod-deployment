-- Sellos repetidos en negocios demo (mikitasks fc08gq62g).
-- La excepción usa el negocio actual, nunca el rol del dueño ni del cliente.
-- El historial se conserva al desmarcar demo: cualquier sello de hoy consume
-- el límite real. Se serializa por cliente, incluso entre tarjetas y vueltas.
-- La PK del sello también identifica el intento: repetir el UUID no vuelve a
-- escribir. El parámetro opcional mantiene llamadas anteriores sin sobrecarga.

 drop function public.owner_get_stamp_card(text);
 drop function public.owner_add_stamp(text);
 drop function public.owner_redeem_stamp_card(uuid);
 drop function public.stamp_card_owner_state(uuid);

 drop index public.stamp_card_stamps_customer_day_key;
 create index stamp_card_stamps_customer_day_idx
   on public.stamp_card_stamps (customer_id, stamp_day);

 comment on table public.stamp_card_stamps is
   'Un sello en una vuelta. Solo lo crea owner_add_stamp: uno por cliente y día en negocios reales, varios en demo. Bloqueo por cliente; id identifica el intento y hace idempotentes sus reintentos.';
 comment on column public.stamp_card_stamps.customer_id is
   'Repetido de la vuelta con FK compuesta. El límite real consulta todo el historial del cliente, entre tarjeta digital, física y vueltas, incluyendo sellos que recibió cuando el negocio era demo.';

CREATE FUNCTION public.stamp_card_owner_state (
  p_customer_id uuid
)
  RETURNS TABLE (
    card_id          uuid,
    business_id      uuid,
    business_name    text,
    program_active   boolean,
    reward           text,
    stamps_required  integer,
    stamps           integer,
    is_full          boolean,
    stamped_today    boolean,
    last_redeemed_at timestamp with time zone,
    daily_limit_applies boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    , not b.is_demo
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."stamp_card_owner_state"(uuid) TO "postgres";

COMMENT ON FUNCTION "public"."stamp_card_owner_state"(uuid) IS 'Interna. Estado de la tarjeta de sellos de un cliente para el panel del dueño: vuelta abierta (card_id null si no hay), si está llena si ya recibió algún sello hoy y si el límite diario aplica (negocio real). No revisa permisos.';

REVOKE ALL ON FUNCTION "public"."stamp_card_owner_state"(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.owner_get_stamp_card (
  p_token text
)
  RETURNS TABLE (
    card_id          uuid,
    business_id      uuid,
    business_name    text,
    program_active   boolean,
    reward           text,
    stamps_required  integer,
    stamps           integer,
    is_full          boolean,
    stamped_today    boolean,
    last_redeemed_at timestamp with time zone,
    daily_limit_applies boolean
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_get_stamp_card"(text) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_get_stamp_card"(text) IS 'Tarjeta de sellos por el token de la digital o de la física, para el panel del dueño. Errores: not_a_card (token inexistente o física revocada), not_your_business, card_not_linked (física de su negocio sin asociar). Devuelve la vuelta abierta (card_id null si no hay), si está llena y si ya recibió un sello hoy y si aplica el límite diario.';

REVOKE ALL ON FUNCTION "public"."owner_get_stamp_card"(text) FROM PUBLIC, anon;

CREATE FUNCTION public.owner_add_stamp (
  p_token text,
  p_operation_id uuid DEFAULT NULL
)
  RETURNS TABLE (
    card_id uuid,
    business_id uuid,
    business_name text,
    program_active boolean,
    reward text,
    stamps_required integer,
    stamps integer,
    is_full boolean,
    stamped_today boolean,
    last_redeemed_at timestamp with time zone,
    daily_limit_applies boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_ref record;
  v_business public.businesses%rowtype;
  v_card public.stamp_cards%rowtype;
  v_previous public.stamp_card_stamps%rowtype;
  v_card_id uuid;
  v_today date := (now() at time zone 'America/Mexico_City')::date;
  v_stamps integer;
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

  -- Mismo orden que el canje: negocio -> cliente -> vuelta. SHARE permite
  -- sellar clientes diferentes y espera a un cambio concurrente de is_demo.
  select * into v_business from public.businesses b
   where b.id = v_ref.business_id for share;
  perform 1 from public.business_customers bc
   where bc.id = v_ref.customer_id for update;

  if p_operation_id is not null then
    select * into v_previous from public.stamp_card_stamps s
     where s.id = p_operation_id;
    if found then
      if v_previous.customer_id <> v_ref.customer_id
         or v_previous.stamped_by is distinct from auth.uid() then
        raise exception 'invalid_stamp_operation' using errcode = 'P0001';
      end if;
      -- Una confirmación perdida sigue siendo confirmable después del canje,
      -- del cambio a real o de apagar el programa. No crea un sello nuevo.
      return query select * from public.stamp_card_owner_state(v_ref.customer_id);
      return;
    end if;
  end if;

  if not (v_business.is_active and v_business.stamp_card_active) then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;
  v_card_id := public.stamp_card_open_card(v_ref.customer_id);
  if v_card_id is null then
    raise exception 'stamp_card_not_available' using errcode = 'P0001';
  end if;
  select * into v_card from public.stamp_cards c
   where c.id = v_card_id for update;
  if v_card.redeemed_at is not null then
    raise exception 'already_redeemed' using errcode = 'P0001';
  end if;

  if not v_business.is_demo and exists (
    select 1 from public.stamp_card_stamps s
     where s.customer_id = v_ref.customer_id and s.stamp_day = v_today
  ) then
    raise exception 'already_stamped_today' using errcode = 'P0001';
  end if;
  select count(*) into v_stamps from public.stamp_card_stamps s
   where s.card_id = v_card.id;
  if v_stamps >= v_card.stamps_required then
    raise exception 'card_full' using errcode = 'P0001';
  end if;

  begin
    insert into public.stamp_card_stamps (id, card_id, customer_id, stamp_day, stamped_by)
    values (coalesce(p_operation_id, gen_random_uuid()), v_card.id,
            v_ref.customer_id, v_today, auth.uid());
  exception when unique_violation then
    -- Un UUID que compite desde otro cliente no es un sello de este intento.
    raise exception 'invalid_stamp_operation' using errcode = 'P0001';
  end;
  return query select * from public.stamp_card_owner_state(v_ref.customer_id);
end;
$function$;
REVOKE ALL ON FUNCTION public.owner_add_stamp(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_add_stamp(text, uuid) TO authenticated;
COMMENT ON FUNCTION public.owner_add_stamp(text, uuid) IS
  'Sella solo tarjetas propias. Límite diario por cliente (America/Mexico_City) salvo negocio demo actual. UUID opcional identifica el sello y deduplica reintentos del mismo dueño y cliente. No permite sobrellenar. invalid_stamp_operation rechaza un UUID ajeno.';

CREATE FUNCTION public.owner_redeem_stamp_card (
  p_card_id uuid
)
  RETURNS TABLE (
    card_id          uuid,
    business_id      uuid,
    business_name    text,
    program_active   boolean,
    reward           text,
    stamps_required  integer,
    stamps           integer,
    is_full          boolean,
    stamped_today    boolean,
    last_redeemed_at timestamp with time zone,
    daily_limit_applies boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
declare
  v_card     public.stamp_cards%rowtype;
  v_customer public.business_customers%rowtype;
  v_stamps   integer;
begin
  select * into v_card
    from public.stamp_cards c
   where c.id = p_card_id
;

  if not found then
    raise exception 'not_a_card' using errcode = 'P0001';
  end if;

  select * into v_customer
    from public.business_customers bc
   where bc.id = v_card.customer_id;

  if not public.is_owner_of(v_customer.business_id) then
    raise exception 'not_your_business' using errcode = 'P0001';
  end if;
  -- Mismo orden que owner_add_stamp: negocio -> cliente -> vuelta.
  -- La lectura inicial solo localiza al cliente; el estado se relee bloqueado.
  perform 1 from public.businesses b
   where b.id = v_customer.business_id for share;
  perform 1 from public.business_customers bc
   where bc.id = v_customer.id for update;
  select * into v_card from public.stamp_cards c
   where c.id = p_card_id for update;

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
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) IS 'Canjea el premio de una vuelta llena de un negocio del dueño, una sola vez, y abre la vuelta siguiente si el programa sigue prendido. Errores: not_a_card, not_your_business, already_redeemed, card_not_full. Devuelve el estado de la tarjeta después del canje.';

REVOKE ALL ON FUNCTION "public"."owner_redeem_stamp_card"(uuid) FROM PUBLIC, anon;
