CREATE OR REPLACE FUNCTION public.owner_business_snapshot (
  p_business_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'description', b.description,
      'category', (select c.name from public.categories c where c.id = b.category_id),
      'phone', b.phone,
      'phone_is_whatsapp', b.phone_is_whatsapp,
      'whatsapp_phone', b.whatsapp_phone,
      'address', b.address,
      'colonia', b.colonia,
      'municipio', b.municipio,
      'maps_url', b.maps_url,
      'facebook_url', b.facebook_url,
      'instagram_url', b.instagram_url,
      'photo_url', b.photo_url,
      'offerings', b.offerings,
      'services_label', b.services_label,
      'has_delivery', b.has_delivery,
      'is_active', b.is_active,
      'promo_active', b.promo_active,
      'promo_title', b.promo_title,
      'promo_body', b.promo_body,
      'promo_ends_at', b.promo_ends_at
    ),
    'hours', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day_of_week', h.day_of_week,
          'opens_at', h.opens_at,
          'closes_at', h.closes_at
        )
        order by h.day_of_week, h.opens_at
      )
      from public.business_hours h
      where h.business_id = b.id
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', ph.id, 'url', ph.url, 'caption', ph.caption, 'kind', ph.kind)
        order by ph.order_index
      )
      from public.business_photos ph
      where ph.business_id = b.id
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'price', s.price,
          'section', s.section,
          'show_in_profile', s.show_in_profile,
          'variants', coalesce((
            select jsonb_agg(
              jsonb_build_object('name', v.name, 'price', v.price)
              order by v.order_index
            )
            from public.business_service_variants v
            where v.service_id = s.id
          ), '[]'::jsonb),
          'option_groups', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', g.name,
                'options', coalesce((
                  select jsonb_agg(
                    jsonb_build_object('name', o.name, 'price_delta', o.price_delta)
                    order by o.order_index
                  )
                  from public.business_service_options o
                  where o.group_id = g.id
                ), '[]'::jsonb)
              )
              order by g.order_index
            )
            from public.business_service_option_groups g
            where g.service_id = s.id
          ), '[]'::jsonb)
        )
        order by s.order_index
      )
      from public.business_services s
      where s.business_id = b.id
        and s.is_published
    ), '[]'::jsonb),
    'feedback', jsonb_build_object(
      'total', (select count(*) from public.business_feedback f where f.business_id = b.id),
      'recent', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'rating', f.rating,
            'liked', f.liked,
            'improve', f.improve,
            'created_at', f.created_at
          )
          order by f.created_at desc
        )
        from (
          select rating, liked, improve, created_at
          from public.business_feedback
          where business_id = b.id
          order by created_at desc
          limit 50
        ) f
      ), '[]'::jsonb)
    )
  )
  from public.businesses b
  where b.id = p_business_id
    and public.is_owner_of(b.id);
$function$;

GRANT EXECUTE ON FUNCTION "public"."owner_business_snapshot"(uuid) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."owner_business_snapshot"(uuid) IS 'Ficha de un negocio para el panel del dueño: datos públicos, horarios, fotos, servicios publicados y las 50 opiniones más recientes con el total. Null si la cuenta no es owner o el negocio no está ligado a ella.';

REVOKE ALL ON FUNCTION "public"."owner_business_snapshot"(uuid) FROM PUBLIC;
