create type public.business_report_reason as enum (
  'cerrado',
  'datos_incorrectos',
  'duplicado',
  'spam',
  'otro'
);

alter table public.business_reports
  add column reason public.business_report_reason not null default 'otro',
  add column note text;

alter table public.business_reports
  alter column reason drop default;

create policy "business_reports_admin_read"
  on public.business_reports for select
  to authenticated
  using (true);
