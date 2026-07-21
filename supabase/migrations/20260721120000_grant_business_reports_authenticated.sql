-- Las policies no bastan sin el grant a nivel tabla (ver business_photos).
-- El insert de anon ya funcionaba por defaults previos; select/delete de
-- authenticated (panel admin) necesitan el grant explícito.
grant select, delete on public.business_reports to authenticated;
