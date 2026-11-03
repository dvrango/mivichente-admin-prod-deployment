CREATE OR REPLACE FUNCTION public.guard_business_stamp_card_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if (
    (
      tg_op = 'INSERT'
      and (
        new.stamp_card_active
        or new.stamp_card_stamps_required is not null
        or new.stamp_card_reward is not null
      )
    )
    or (
      tg_op = 'UPDATE'
      and (
        old.stamp_card_active is distinct from new.stamp_card_active
        or old.stamp_card_stamps_required is distinct from new.stamp_card_stamps_required
        or old.stamp_card_reward is distinct from new.stamp_card_reward
      )
    )
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.stamp_card_*'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."guard_business_stamp_card_admin"() TO "postgres";

COMMENT ON FUNCTION "public"."guard_business_stamp_card_admin"() IS 'Impide que cualquier identidad de aplicación distinta de admin cambie la configuración de la tarjeta de sellos. Solo exceptúa postgres para operación de infraestructura.';

REVOKE ALL ON FUNCTION "public"."guard_business_stamp_card_admin"() FROM PUBLIC;
