CREATE TYPE "public"."business_report_reason" AS ENUM (
  'cerrado',
  'datos_incorrectos',
  'duplicado',
  'spam',
  'otro'
);

GRANT USAGE ON TYPE "public"."business_report_reason" TO "postgres";
