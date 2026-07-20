-- `kind`: QUÉ es la foto, separado de `caption`, que es cómo se titula al
-- mostrarla.
--
-- Motivo: la foto del menú no es una foto más de la galería, es un documento
-- que después procesa la IA para llenar `business_services`. Encontrarla con
-- `caption ilike '%menu%'` sería match de string contra una etiqueta de
-- display: se rompe si alguien reescribe el título, y no hay forma de saber si
-- 'Menú del día' cuenta. Con `kind` la consulta del pipeline es
-- `where kind = 'menu'` y no depende de texto editable.
--
-- Además el modo campo lo setea AL DISPARAR (el botón dice qué vas a
-- fotografiar), no después, así que no se puede olvidar.
alter table business_photos
  add column if not exists kind text not null default 'otro';

alter table business_photos
  drop constraint if exists business_photos_kind_check;
alter table business_photos
  add constraint business_photos_kind_check
  check (kind in ('fachada', 'interior', 'producto', 'menu', 'equipo', 'otro'));

-- Backfill desde los captions que ya existían (los ponía el modo campo con esa
-- misma lista). Lo que no matchee se queda en 'otro'.
update business_photos
set kind = case
  when caption ilike 'fachada%'  then 'fachada'
  when caption ilike 'interior%' then 'interior'
  when caption ilike 'producto%' then 'producto'
  when caption ilike 'men%'      then 'menu'
  when caption ilike 'equipo%'   then 'equipo'
  else 'otro'
end
where caption is not null and kind = 'otro';

-- El pipeline de IA barre por aquí: pocas filas frente al total de la galería.
create index if not exists business_photos_menu_idx
  on business_photos (business_id)
  where kind = 'menu';
