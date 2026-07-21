-- La tabla nunca tuvo un grant explícito de insert para anon: en prod
-- funcionaba por un default de proyecto que la DB local (recreada desde
-- migrations) no replica. Se hace explícito para que el flujo de reporte
-- de la app mobile funcione contra Supabase local.
grant insert on public.business_reports to anon;
