CREATE OR REPLACE FUNCTION public.business_owner_contacts_stamp()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."business_owner_contacts_stamp"() TO "postgres";
