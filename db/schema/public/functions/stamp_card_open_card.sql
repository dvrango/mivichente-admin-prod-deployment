CREATE OR REPLACE FUNCTION public.stamp_card_open_card (
  p_holder_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."stamp_card_open_card"(uuid) TO "postgres";

COMMENT ON FUNCTION "public"."stamp_card_open_card"(uuid) IS 'Interna. Devuelve la vuelta abierta del cliente; si no tiene y el programa del negocio está prendido, la abre con la configuración vigente. Null si no hay y no se puede abrir.';

REVOKE ALL ON FUNCTION "public"."stamp_card_open_card"(uuid) FROM PUBLIC;
