CREATE OR REPLACE FUNCTION public.guard_business_feedback_reward_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if (
    (
      tg_op = 'INSERT'
      and (
        new.feedback_reward_active
        or new.feedback_reward_benefit is not null
        or new.feedback_reward_days <> 30
      )
    )
    or (
      tg_op = 'UPDATE'
      and (
        old.feedback_reward_active is distinct from new.feedback_reward_active
        or old.feedback_reward_benefit is distinct from new.feedback_reward_benefit
        or old.feedback_reward_days is distinct from new.feedback_reward_days
      )
    )
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.feedback_reward_*'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."guard_business_feedback_reward_admin"() TO "postgres";

COMMENT ON FUNCTION "public"."guard_business_feedback_reward_admin"() IS 'Impide que cualquier identidad de aplicación distinta de admin cambie la configuración de opiniones con descuento. Solo exceptúa postgres para operación de infraestructura.';

REVOKE ALL ON FUNCTION "public"."guard_business_feedback_reward_admin"() FROM PUBLIC;
