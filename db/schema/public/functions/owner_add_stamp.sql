CREATE OR REPLACE FUNCTION public.owner_add_stamp (
  p_token        text,
  p_operation_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    card_id             uuid,
    business_id         uuid,
    business_name       text,
    program_active      boolean,
    reward              text,
    stamps_required     integer,
    stamps              integer,
    is_full             boolean,
    stamped_today       boolean,
    last_redeemed_at    timestamp with time zone,
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

GRANT EXECUTE ON FUNCTION "public"."owner_add_stamp"(text, uuid) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_add_stamp"(text, uuid) IS 'Sella solo tarjetas propias. Límite diario por cliente (America/Mexico_City) salvo negocio demo actual. UUID opcional identifica el sello y deduplica reintentos del mismo dueño y cliente. No permite sobrellenar. invalid_stamp_operation rechaza un UUID ajeno.';

REVOKE ALL ON FUNCTION "public"."owner_add_stamp"(text, uuid) FROM PUBLIC;
