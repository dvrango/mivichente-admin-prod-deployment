CREATE OR REPLACE FUNCTION public.admin_create_physical_cards (
  p_business_id uuid,
  p_count       integer
)
  RETURNS TABLE (
    token text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'permission denied: only admin can create physical cards'
      using errcode = '42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'invalid_count' using errcode = '22023';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'business_not_found' using errcode = 'P0001';
  end if;

  return query
  insert into public.physical_cards as pc (business_id, created_by)
  select p_business_id, auth.uid()
    from generate_series(1, p_count)
  returning pc.token;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."admin_create_physical_cards"(uuid, integer) TO "authenticated", "postgres";

COMMENT ON FUNCTION "public"."admin_create_physical_cards"(uuid, integer) IS 'Solo admin. Genera p_count (1 a 100) tarjetas físicas sin asociar para un negocio y regresa sus tokens para el PDF de impresión. Las de una llamada comparten created_at: eso identifica la hoja.';

REVOKE ALL ON FUNCTION "public"."admin_create_physical_cards"(uuid, integer) FROM PUBLIC;
