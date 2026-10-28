CREATE OR REPLACE FUNCTION public.submit_business_feedback (
  p_slug      text,
  p_device_id text,
  p_rating    integer,
  p_liked     text    DEFAULT NULL::text,
  p_improve   text    DEFAULT NULL::text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."submit_business_feedback"(text, text, integer, text, text) TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."submit_business_feedback"(text, text, integer, text, text) IS 'Guarda una opinión y crea su descuento; devuelve el token del descuento. Uno por device y negocio: si ya existe, error already_submitted sin guardar otra opinión ni devolver el token existente. Error feedback_not_accepted si el negocio no está activo o no tiene el interruptor prendido.';

REVOKE ALL ON FUNCTION "public"."submit_business_feedback"(text, text, integer, text, text) FROM PUBLIC;
