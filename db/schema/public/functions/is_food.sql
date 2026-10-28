CREATE OR REPLACE FUNCTION public.is_food (
  b public.businesses
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
      from public.categories c
     where c.id = b.category_id
       and c.type = 'food'
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_food"(public.businesses) TO "anon", "authenticated", "postgres", "service_role";

COMMENT ON FUNCTION "public"."is_food"(public.businesses) IS 'Si el negocio ofrece comida pedible: su categoría PRINCIPAL es de tipo food. Criterio único para mostrar el carrito. No usar services_label, que es solo display.';

REVOKE ALL ON FUNCTION "public"."is_food"(public.businesses) FROM PUBLIC;
