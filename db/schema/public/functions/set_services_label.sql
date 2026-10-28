CREATE OR REPLACE FUNCTION public.set_services_label()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  cat_type text;
begin
  select c.type into cat_type
    from public.categories c
   where c.id = new.category_id;

  -- Sin categoría principal todavía (alta de campo, scraper) se deja null: el
  -- cliente cae a 'Servicios' por default y el label se corrige solo cuando
  -- alguien le asigne categoría.
  if cat_type is null then
    new.services_label := null;
  elsif cat_type = 'food' then
    new.services_label := 'Menú';
  else
    new.services_label := 'Servicios';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_services_label"() TO "postgres";
