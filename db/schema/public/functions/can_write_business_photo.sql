CREATE OR REPLACE FUNCTION public.can_write_business_photo (
  object_name text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select case
    when object_name is null then false
    when position('/' in object_name) = 0 then public.is_staff()
    when split_part(object_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_edit_business(split_part(object_name, '/', 1)::uuid)
    -- Carpeta que no es un id de negocio: no hay a qué municipio atarla.
    else public.is_staff()
  end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."can_write_business_photo"(text) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."can_write_business_photo"(text) IS 'True si la cuenta actual puede escribir el objeto dado del bucket business-photos. Si el path cuelga de una carpeta con id de negocio, aplica can_edit_business(); si está en la raíz (form de escritorio, que sube antes de crear el negocio), basta con ser staff.';
