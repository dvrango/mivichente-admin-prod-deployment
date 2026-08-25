-- Foto en la solicitud de registro: el dueño la sube desde la landing.
--
-- Hasta ahora, cada alta que entraba por el formulario obligaba a alguien a
-- entrar a mano a Facebook, buscar la página del negocio y bajarle una foto.
-- 246 de 400 negocios activos no tienen ninguna, y sin foto la tarjeta "Ya
-- estamos en Vichente App" —la pieza que el dueño publica en sus redes— sale
-- con el isotipo de Vichente en vez del suyo. O sea: la foto que falta rompe el
-- canal de distribución, no sólo la estética.
--
-- La foto NO entra al bucket `business-photos`. Va a un bucket de staging
-- aparte por dos razones:
--
--   1. Moderación por construcción. `business-photos` es público: lo que cae
--      ahí es visible en la app en el momento en que se sube. Una foto que
--      llega de un formulario abierto puede ser de un tercero, un logo ajeno o
--      contenido inapropiado, y no debe poder publicarse sin que un admin la
--      vea. Este bucket es privado, así que nada de lo que cae aquí se ve en
--      ningún lado hasta que la aprobación lo copia al bucket público.
--   2. `business-photos` no se toca. Su policy de escritura sigue siendo sólo
--      para `authenticated`, igual que antes de esta migración.
--
-- Quién escribe aquí: el Server Action de la landing, con la service role key.
-- Por eso NO hay policy de INSERT — service role no pasa por RLS. Que no haya
-- policy para `anon` es la garantía de que nadie puede subir desde el navegador
-- aunque descubra la URL del bucket.

-- Array y no una sola columna porque el dueño puede subir hasta 3 (el tope vive
-- en la landing, no aquí: la primera es la portada y las demás entran a la
-- galería detrás de ella). Vacío es lo normal — la foto es opcional de punta a
-- punta y el registro nunca se pierde por ella.
alter table public.business_registrations
  add column photo_paths text[] not null default '{}';

comment on column public.business_registrations.photo_paths is
  'Paths dentro del bucket `registration-photos`, en orden: el primero es la
   portada. Es staging — al aprobar se copian a `business-photos` y se borran de
   aquí; al rechazar sólo se borran.';

-- Bucket privado y con defensas desde el arranque. `business-photos` nació sin
-- límites (file_size_limit y allowed_mime_types en null) y ahí no importaba
-- porque sólo escribe un admin autenticado; en cuanto la escritura la dispara
-- un formulario público, un bucket sin techo es abuso garantizado.
--
-- Los valores son los mismos que ya valida Zod en el admin (PHOTO_MAX_BYTES,
-- PHOTO_ALLOWED_MIME): 5 MB y JPG/PNG/WEBP. En la práctica nunca se llega —
-- la landing comprime en el navegador y una foto de celular sale en 200-400 KB.
-- El límite es la red de abajo, no el requisito que ve el dueño.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registration-photos',
  'registration-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- El admin necesita ver la foto ANTES de aprobar (si nadie la mira, la revisión
-- humana que hoy existe se pierde) y borrarla después. Lectura y borrado para
-- `authenticated`, nada para `anon`.
drop policy if exists "registration-photos admin read" on storage.objects;
create policy "registration-photos admin read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'registration-photos');

drop policy if exists "registration-photos admin delete" on storage.objects;
create policy "registration-photos admin delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'registration-photos');
