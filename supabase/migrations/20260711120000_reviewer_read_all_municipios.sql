-- Decisión de producto: el reviewer scopeado a un municipio (ej. Dani en Villa
-- Unión) debe poder VER negocios de otros municipios en el panel (lista y
-- simulador de búsqueda usa rol anon aparte, ver anon-client.ts), aunque siga
-- sin poder editarlos/borrarlos. Antes `businesses_select` filtraba por
-- municipio == user_municipio() para todo authenticated no-admin; eso ya no
-- aplica, solo al select. Insert/update/delete siguen scopeados: un reviewer
-- no puede escribir negocios de otro municipio aunque ahora los vea.
drop policy if exists businesses_select on public.businesses;
create policy businesses_select
  on public.businesses
  for select
  to authenticated
  using (true);

-- Mismo criterio para las tablas hijas: si el reviewer ve el negocio de otro
-- municipio en la lista/detalle, también debe ver sus categorías y horario
-- (solo lectura). Insert/delete siguen exigiendo match de municipio.
drop policy if exists business_categories_select_auth on public.business_categories;
create policy business_categories_select_auth
  on public.business_categories
  for select
  to authenticated
  using (true);

drop policy if exists business_hours_select_auth on public.business_hours;
create policy business_hours_select_auth
  on public.business_hours
  for select
  to authenticated
  using (true);
