CREATE OR REPLACE FUNCTION public.set_option_business_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  select g.business_id into new.business_id
    from public.business_service_option_groups g
   where g.id = new.group_id;

  if new.business_id is null then
    raise exception 'El grupo de opciones % no existe', new.group_id;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_option_business_id"() TO "postgres";
