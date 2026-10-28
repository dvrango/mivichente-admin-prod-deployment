CREATE OR REPLACE FUNCTION public.set_option_group_business_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  select s.business_id into new.business_id
    from public.business_services s
   where s.id = new.service_id;

  if new.business_id is null then
    raise exception 'El platillo % no existe', new.service_id;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_option_group_business_id"() TO "postgres";
