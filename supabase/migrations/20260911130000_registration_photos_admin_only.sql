-- El bucket `registration-photos` vuelve a ser solo-admin.
--
-- Qué estaba mal: `20260911120000_lock_down_authenticated_access` cambió las dos
-- policies del bucket de "cualquier authenticated" a `is_staff()`. Eso cerró el
-- hueco grande —la cuenta recién registrada— pero dejó dentro al reviewer, y las
-- solicitudes de registro son solo-admin en todo lo demás:
--
--   admin_select_business_registrations  SELECT  using (is_admin())
--   admin_update_business_registrations  UPDATE  using/check (is_admin())
--
-- O sea: un reviewer no veía la solicitud en `/registrations`, pero sí podía
-- listar sus fotos, firmarles URL y borrarlas. El bucket es PRIVADO a propósito
-- (ver `src/lib/registration-photos.ts`): guarda lo que manda un negocio por el
-- formulario público de la landing, que puede ser un logo ajeno o contenido
-- inapropiado, y que todavía no aprueba nadie.
--
-- Nadie pierde acceso que use:
--   - el único consumidor del bucket es `/registrations`, cuyo layout ya corre
--     `requireAdmin()` y cuyas queries/actions usan el cliente del usuario, así
--     que RLS es el gate real;
--   - la landing escribe con la service role key, que no pasa por policy;
--   - `registration-photos` no tiene policy de INSERT ni de UPDATE para
--     `authenticated`, y esta migración tampoco le agrega una.
--
-- Se recupera el nombre `admin` que traían antes de 20260911120000: el nombre de
-- la policy es lo único que se lee al listarlas, y decir `staff` mientras el
-- predicado dice `is_admin()` es justo la clase de desfase que originó el bug.
-- Se dropean los dos nombres para que la migración sea idempotente venga de
-- donde venga la base.

drop policy if exists "registration-photos staff read" on storage.objects;
drop policy if exists "registration-photos admin read" on storage.objects;

create policy "registration-photos admin read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'registration-photos' and public.is_admin());

drop policy if exists "registration-photos staff delete" on storage.objects;
drop policy if exists "registration-photos admin delete" on storage.objects;

create policy "registration-photos admin delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'registration-photos' and public.is_admin());
