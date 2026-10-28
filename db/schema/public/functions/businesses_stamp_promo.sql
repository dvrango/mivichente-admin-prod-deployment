CREATE OR REPLACE FUNCTION public.businesses_stamp_promo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if tg_op = 'INSERT' then
    new.promo_updated_at := case
      when new.promo_title is not null or new.promo_body is not null or new.promo_ends_at is not null
        then now()
    end;
  elsif new.promo_title is distinct from old.promo_title
     or new.promo_body is distinct from old.promo_body
     or new.promo_ends_at is distinct from old.promo_ends_at then
    new.promo_updated_at := now();
  else
    -- El sello es de la DB: un cliente no lo mueve sin cambiar el contenido,
    -- así nadie vuelve a mostrar (o esconde) el modal a todos a mano.
    new.promo_updated_at := old.promo_updated_at;
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."businesses_stamp_promo"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."businesses_stamp_promo"() FROM PUBLIC;
