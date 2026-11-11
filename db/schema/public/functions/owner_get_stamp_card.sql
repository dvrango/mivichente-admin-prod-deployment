CREATE OR REPLACE FUNCTION public.owner_get_stamp_card (
  p_token text
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

REVOKE ALL ON FUNCTION "public"."owner_get_stamp_card"(text) FROM PUBLIC;
