CREATE OR REPLACE FUNCTION public.is_owner_of (
  p_business_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.business_owners o
    join public.profiles p on p.id = o.profile_id
    where o.profile_id = auth.uid()
      and p.role = 'owner'
      and o.business_id = p_business_id
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_owner_of"(uuid) TO "postgres";

COMMENT ON FUNCTION "public"."is_owner_of"(uuid) IS 'True si la cuenta actual tiene rol owner y el negocio está ligado a ella en business_owners. Punto único de la regla de lectura del panel del dueño.';

REVOKE ALL ON FUNCTION "public"."is_owner_of"(uuid) FROM PUBLIC;
