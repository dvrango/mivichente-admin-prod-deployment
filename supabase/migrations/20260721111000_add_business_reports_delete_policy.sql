create policy "business_reports_admin_delete"
  on public.business_reports for delete
  to authenticated
  using (true);
