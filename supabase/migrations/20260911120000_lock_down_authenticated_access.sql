-- Cerrar el acceso que hoy gana cualquiera que se registre.
--
-- Qué estaba mal: `GET /auth/v1/settings` en prod devuelve `disable_signup:
-- false`. Con la anon key (pública por diseño, va en el bundle web) cualquiera
-- se registra, confirma el correo y queda con rol `authenticated`. El trigger
-- `handle_new_user()` le inserta el perfil sin rol, así que cae al default de la
-- columna — que era `'reviewer'`. Y varias policies le daban permiso a
-- `authenticated` con `using (true)`, sin mirar rol ni municipio:
--
--   business_photos    ALL  using(true) check(true)  -> borrar/reemplazar las 273 fotos
--   business_reports   SELECT + DELETE using(true)   -> leer y borrar reportes de abuso
--   businesses         SELECT using(true)            -> los 556 negocios, incluidos 181 sin publicar
--   storage.objects    ALL sobre 'business-photos'   -> subir/borrar cualquier archivo
--
-- Las policies se llaman `*_admin_all` pero ninguna llamaba a `is_admin()`.
--
-- Cerrar el signup en el dashboard NO es el fix: los reviewers existentes
-- conservan esos permisos, y el día que se reabra (o se invite a alguien) el
-- hueco vuelve completo. El fix es que una cuenta sin rol asignado no pueda
-- nada, y que cada escritura mire el municipio del negocio.
--
-- Decisiones de producto que fija esta migración (2026-09-11):
--   1. Cuenta nueva nace en `pending`: ni lee ni escribe. Un admin le asigna rol
--      y municipio a mano, que es como ya se dan de alta los usuarios hoy.
--   2. Un reviewer LEE negocios de todos los municipios y ESCRIBE solo los del
--      suyo. Es la misma regla de `20260711120000_reviewer_read_all_municipios`
--      y de `20260902120000_business_services_rls_scoped_and_authorship`.
--   3. Los reportes de abuso los lee todo el staff, pero solo los descarta quien
--      puede editar el negocio reportado.

-- ============================================================
-- is_staff(): "esta cuenta es parte del equipo"
-- ============================================================
--
-- Hasta hoy la pregunta "¿es alguien del equipo?" se contestaba sola: estar
-- autenticado era serlo. Con el rol `pending` deja de serlo, así que hace falta
-- decirlo explícito en cada lectura.
--
-- security definer con search_path fijo, igual que is_admin()/user_municipio():
-- la autorización no puede depender de si el que pregunta alcanza a ver su
-- propia fila de `profiles`.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'reviewer')
  );
$$;

comment on function public.is_staff() is
  'True si la cuenta actual tiene rol asignado (admin o reviewer). False para `pending`, o sea para cualquiera que se haya registrado y todavía no habilite un admin. Es el gate de LECTURA del panel; la escritura la decide can_edit_business().';

grant execute on function public.is_staff() to authenticated;

-- user_municipio() devolvía el municipio sin mirar el rol. Con `pending` en la
-- mesa eso es un riesgo gratis: si alguna vez una cuenta sin rol termina con
-- municipio (un update mal hecho, un backfill), heredaría permiso de escritura
-- sobre ese municipio entero vía can_edit_business(). Se ata al rol.
create or replace function public.user_municipio()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select municipio from public.profiles
  where id = auth.uid() and role in ('admin', 'reviewer');
$$;

comment on function public.user_municipio() is
  'Municipio de la cuenta actual, solo si tiene rol de staff. Null para `pending` y para el admin (que no está atado a un municipio).';

-- ============================================================
-- Rol `pending`: registrarse ya no otorga nada
-- ============================================================
--
-- El CHECK se amplía ANTES de mover el default, si no el default nuevo choca
-- contra la restricción vieja.
--
-- Sin backfill a propósito: los perfiles que ya existen (2 admin, 3 reviewer)
-- conservan su rol. Esta migración no le quita acceso a nadie que hoy trabaje.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'reviewer', 'pending'));

alter table public.profiles
  alter column role set default 'pending';

comment on column public.profiles.role is
  'admin | reviewer | pending. `pending` es el default de toda cuenta nueva y no da acceso a nada: un admin le asigna rol y municipio desde el dashboard de Supabase. No existe policy de UPDATE sobre profiles, así que nadie se autopromueve.';

-- ============================================================
-- Lecturas: de "estar autenticado" a "ser staff"
-- ============================================================
--
-- Ninguna de estas cambia lo que ve un reviewer: sigue leyendo todos los
-- municipios. Lo único que cambia es que una cuenta `pending` ve cero filas.
-- Las policies de `anon` (la app mobile, la landing, el menú de mesa) no se
-- tocan en toda la migración.

drop policy if exists "businesses_select" on public.businesses;
create policy businesses_select
  on public.businesses
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists "business_services_select_auth" on public.business_services;
create policy business_services_select_auth
  on public.business_services
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists "business_hours_select_auth" on public.business_hours;
create policy business_hours_select_auth
  on public.business_hours
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists "business_categories_select_auth" on public.business_categories;
create policy business_categories_select_auth
  on public.business_categories
  for select
  to authenticated
  using (public.is_staff());

-- `categories` entra por consistencia, no por gravedad: lo único que expone de
-- más son las categorías inactivas (anon ya lee las activas).
drop policy if exists "categories_select_auth" on public.categories;
create policy categories_select_auth
  on public.categories
  for select
  to authenticated
  using (public.is_staff());

-- ============================================================
-- business_photos: adiós al FOR ALL using(true)
-- ============================================================
--
-- Mismo patrón que business_services el 2026-09-02: SELECT abierto al staff
-- (scopearlo le vaciaría las fotos al reviewer que abre un negocio de otro
-- municipio, que es una regresión, no una protección), escritura por
-- can_edit_business().

drop policy if exists "business_photos_admin_all" on public.business_photos;

create policy business_photos_select_auth
  on public.business_photos
  for select
  to authenticated
  using (public.is_staff());

create policy business_photos_insert
  on public.business_photos
  for insert
  to authenticated
  with check (public.can_edit_business(business_id));

-- El with check cubre además mover una foto a otro business_id: el destino
-- también tiene que ser editable.
create policy business_photos_update
  on public.business_photos
  for update
  to authenticated
  using (public.can_edit_business(business_id))
  with check (public.can_edit_business(business_id));

create policy business_photos_delete
  on public.business_photos
  for delete
  to authenticated
  using (public.can_edit_business(business_id));

-- ============================================================
-- business_reports: leer todos, descartar solo los propios
-- ============================================================
--
-- `anyone can report` (INSERT desde anon) NO se toca: es la que deja reportar
-- desde la app sin cuenta.

drop policy if exists "business_reports_admin_read" on public.business_reports;
create policy business_reports_select_auth
  on public.business_reports
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists "business_reports_admin_delete" on public.business_reports;
create policy business_reports_delete
  on public.business_reports
  for delete
  to authenticated
  using (public.can_edit_business(business_id));

-- ============================================================
-- Storage: el bucket business-photos
-- ============================================================
--
-- El path dentro del bucket tiene dos formas, y la policy tiene que aguantar
-- las dos:
--
--   {businessId}/{uuid}.webp   modo campo y editor de menú — se conoce el negocio
--   {uuid}.webp                form de escritorio — sube ANTES de que el negocio exista
--
-- La segunda no se puede scopear por municipio: al subir todavía no hay a qué
-- negocio amarrarla. Hoy es la forma más común (82 de 92 objetos en local están
-- en la raíz). Así que la raíz queda abierta al staff — que son 5 personas
-- conocidas — y lo que se cierra ahí es la cuenta recién registrada, que es el
-- hueco que abre esta tarea.
--
-- Si algún día se quiere cerrar también la raíz, el camino es que el form de
-- escritorio suba a una carpeta de staging por usuario y esta función exija que
-- el primer segmento sea el auth.uid() de quien sube. No hace falta hoy.

create or replace function public.can_write_business_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when object_name is null then false
    when position('/' in object_name) = 0 then public.is_staff()
    when split_part(object_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_edit_business(split_part(object_name, '/', 1)::uuid)
    -- Carpeta que no es un id de negocio: no hay a qué municipio atarla.
    else public.is_staff()
  end;
$$;

comment on function public.can_write_business_photo(text) is
  'True si la cuenta actual puede escribir el objeto dado del bucket business-photos. Si el path cuelga de una carpeta con id de negocio, aplica can_edit_business(); si está en la raíz (form de escritorio, que sube antes de crear el negocio), basta con ser staff.';

grant execute on function public.can_write_business_photo(text) to authenticated;

drop policy if exists "business-photos admin write" on storage.objects;

create policy "business-photos staff insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'business-photos'
    and public.can_write_business_photo(name)
  );

create policy "business-photos staff update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'business-photos'
    and public.can_write_business_photo(name)
  )
  with check (
    bucket_id = 'business-photos'
    and public.can_write_business_photo(name)
  );

create policy "business-photos staff delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'business-photos'
    and public.can_write_business_photo(name)
  );

-- `"business-photos public read"` NO se toca: el bucket es público y así es
-- como la app y la landing muestran las fotos.

-- registration-photos entra por el mismo hueco, y es peor: bucket PRIVADO con
-- las fotos que suben los negocios desde el formulario de la landing, legible y
-- borrable por cualquiera que se registrara.
drop policy if exists "registration-photos admin read" on storage.objects;
create policy "registration-photos staff read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'registration-photos' and public.is_staff());

drop policy if exists "registration-photos admin delete" on storage.objects;
create policy "registration-photos staff delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'registration-photos' and public.is_staff());

-- ============================================================
-- Límites del bucket business-photos
-- ============================================================
--
-- Estaba en `file_size_limit = NULL` y `allowed_mime_types = ANY`: subida
-- ilimitada de cualquier tipo de archivo, servida desde el dominio del proyecto.
-- Eso es hosting gratis para quien sea, y con un mime type arbitrario es peor
-- que gratis.
--
-- 5 MB es el mismo límite que ya valida Zod en el form, así que no cambia nada
-- de lo que hoy pasa. Los heic/heif están en la lista a propósito: cuando
-- `createImageBitmap` falla, compressImage sube el archivo original sin
-- convertir, y en iOS eso es un heic.

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'business-photos';
