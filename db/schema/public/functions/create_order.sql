CREATE OR REPLACE FUNCTION public.create_order (
  p_business_id          uuid,
  p_items                jsonb,
  p_mode                 text,
  p_customer_name        text,
  p_customer_phone       text,
  p_expected_total_cents integer,
  p_delivery_lat         double precision DEFAULT NULL::double precision,
  p_delivery_lng         double precision DEFAULT NULL::double precision,
  p_delivery_directions  text             DEFAULT NULL::text,
  p_delivery_references  text             DEFAULT NULL::text,
  p_pays_with            text             DEFAULT NULL::text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

GRANT EXECUTE
  ON FUNCTION "public"."create_order"(uuid, jsonb, text, text, text, integer, double precision, double precision, text, text, text)
  TO "anon", "authenticated", "postgres";

COMMENT ON FUNCTION "public"."create_order"(uuid, jsonb, text, text, text, integer, double precision, double precision, text, text, text) IS 'Crea un pedido del flujo con estados y devuelve su token. p_items: [{service_id, variant_id?, option_ids?, quantity, note?}]. Los precios salen del menú vigente; price_changed si el total no es p_expected_total_cents. Errores (mensaje): orders_not_available, business_without_whatsapp, delivery_not_available, item_not_available, item_without_price, item_options_invalid, price_changed (P0001); invalid_mode, invalid_customer_name, invalid_customer_phone, invalid_pays_with, invalid_location, location_required, invalid_items (22023).';

REVOKE ALL ON FUNCTION "public"."create_order"(uuid, jsonb, text, text, text, integer, double precision, double precision, text, text, text) FROM PUBLIC;
