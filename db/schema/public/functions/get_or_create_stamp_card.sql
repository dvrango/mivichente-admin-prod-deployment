CREATE OR REPLACE FUNCTION public.get_or_create_stamp_card (
  p_slug      text,
  p_device_id text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_or_create_stamp_card"(text, text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."get_or_create_stamp_card"(text, text) IS 'Crea la tarjeta de sellos de un celular en un negocio y devuelve su token. Error stamp_card_not_available si el negocio no está activo o no tiene el programa prendido; already_has_card si ese celular ya tiene una (no devuelve el token existente).';

REVOKE ALL ON FUNCTION "public"."get_or_create_stamp_card"(text, text) FROM PUBLIC;
