CREATE OR REPLACE FUNCTION public.immutable_unaccent (
  text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
  AS $function$ SELECT unaccent('unaccent', $1) $function$;

GRANT EXECUTE ON FUNCTION "public"."immutable_unaccent"(text) TO "postgres", "service_role";
