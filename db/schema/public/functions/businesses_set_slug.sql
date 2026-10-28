CREATE OR REPLACE FUNCTION public.businesses_set_slug()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.unique_business_slug(new.name, new.id);
  else
    new.slug := public.slugify(new.slug);
    -- Si tras normalizar quedó vacío, reservado o duplicado, recalcula.
    if new.slug = ''
       or public.slug_is_reserved(new.slug)
       or exists (
         select 1 from public.businesses b
         where b.slug = new.slug and b.id <> new.id
       )
    then
      new.slug := public.unique_business_slug(coalesce(nullif(new.slug, ''), new.name), new.id);
    end if;
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."businesses_set_slug"() TO "postgres";
