CREATE OR REPLACE FUNCTION public.guard_business_in_directory()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  -- Only an admin sets the flag. Without this, the reviewer of a municipio
  -- could take a real business out of the directory. Same pattern as is_demo.
  if (
    (tg_op = 'INSERT' and not new.in_directory)
    or (tg_op = 'UPDATE' and old.in_directory is distinct from new.in_directory)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.in_directory'
      using errcode = '42501';
  end if;

  -- Checked against what the caller sent, so the default below does not
  -- count as a change made by a non-admin.
  if new.municipio = any (array['Durango'])
     and (tg_op = 'INSERT' or old.municipio is distinct from new.municipio) then
    new.in_directory := false;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."guard_business_in_directory"() TO "postgres";

COMMENT ON FUNCTION "public"."guard_business_in_directory"() IS 'Lets only admin (or postgres) change businesses.in_directory, and turns it off when a business is created in or moved to Durango.';

REVOKE ALL ON FUNCTION "public"."guard_business_in_directory"() FROM PUBLIC;
