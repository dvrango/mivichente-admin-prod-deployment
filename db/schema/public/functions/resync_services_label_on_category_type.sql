CREATE OR REPLACE FUNCTION public.resync_services_label_on_category_type()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  label_nuevo text;
begin
  label_nuevo := case when new.type = 'food' then 'Menú' else 'Servicios' end;

  update public.businesses
     set services_label = services_label
   where category_id = new.id
     and services_label is distinct from label_nuevo;

  return null;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."resync_services_label_on_category_type"() TO "postgres";
