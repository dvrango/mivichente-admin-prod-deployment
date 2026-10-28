CREATE OR REPLACE FUNCTION public.reject_size_option_group()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  normalizado text;
begin
  normalizado := trim(regexp_replace(
    lower(translate(new.name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
    '\s+', ' ', 'g'
  ));

  if normalizado = any (array[
    'tamano', 'tamanos',
    'size', 'sizes',
    'presentacion', 'presentaciones'
  ]) then
    raise exception
      'Los tamaños se capturan como variantes del platillo (business_service_variants), no como grupo de opciones. El grupo "%" tiene que ir ahí, o llamarse de otra forma si no es un tamaño.',
      new.name;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reject_size_option_group"() TO "postgres";
