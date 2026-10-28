CREATE OR REPLACE FUNCTION public.unique_business_slug (
  base       text,
  exclude_id uuid DEFAULT NULL::uuid
)
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  AS $function$
declare
  root text := nullif(public.slugify(base), '');
  candidate text;
  n int := 1;
begin
  if root is null then
    root := 'negocio';
  end if;
  candidate := root;
  loop
    -- reservado o ya tomado por otra fila → prueba el siguiente sufijo
    if public.slug_is_reserved(candidate)
       or exists (
         select 1 from public.businesses b
         where b.slug = candidate
           and (exclude_id is null or b.id <> exclude_id)
       )
    then
      n := n + 1;
      candidate := root || '-' || n;
    else
      return candidate;
    end if;
  end loop;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."unique_business_slug"(text, uuid) TO "postgres";
