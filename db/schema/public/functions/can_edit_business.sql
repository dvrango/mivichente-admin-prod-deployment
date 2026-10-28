CREATE OR REPLACE FUNCTION public.can_edit_business (
  target_business_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
      and (public.is_admin() or b.municipio = public.user_municipio())
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."can_edit_business"(uuid) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."can_edit_business"(uuid) IS 'True si el usuario actual puede ESCRIBIR el negocio dado: admin (sin restricción) o reviewer del mismo municipio. Punto único de la regla de autorización de escritura sobre un negocio y sus tablas hijas. No aplica a lectura: leer negocios de otros municipios sí está permitido (ver 20260711120000).';
