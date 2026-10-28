CREATE OR REPLACE FUNCTION public.businesses_record_old_slug()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.slug is distinct from old.slug and coalesce(old.slug, '') <> '' then
    -- El slug que acaba de tomar este negocio deja de ser histórico de nadie:
    -- lo vivo siempre gana sobre lo archivado.
    delete from public.business_slug_history where slug = new.slug;

    insert into public.business_slug_history (business_id, slug)
    values (old.id, old.slug)
    on conflict (slug) do update
      set business_id = excluded.business_id,
          replaced_at = now();
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."businesses_record_old_slug"() TO "postgres";
