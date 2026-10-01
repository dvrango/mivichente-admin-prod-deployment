-- Datos del dueño fuera de la lectura pública (tarea yekdqmi27), parte 2.
--
-- DESTRUCTIVA. Va en un db:push aparte, DESPUÉS de desplegar el admin que lee y
-- escribe `business_owner_contacts`. Si se aplica antes, el admin viejo truena
-- al guardar la ficha o la captura de campo.
--
-- Con las columnas fuera de `businesses`, `select('*')` y las RPC
-- `search_businesses` / `businesses_open_now` (setof businesses, cuerpo SQL no
-- atómico que se re-planea en cada llamada) dejan de regresar los datos del
-- dueño sin cambiar nada del lado del cliente.

-- Última pasada por si algo escribió en las columnas viejas sin pasar por el
-- puente: solo rellena huecos, nunca pisa lo que ya escribió el admin nuevo.
insert into public.business_owner_contacts (business_id, owner, owner_phone, owner_contact_note)
select
  b.id,
  nullif(trim(b.owner), ''),
  nullif(trim(b.owner_phone), ''),
  nullif(trim(b.owner_contact_note), '')
from public.businesses b
where coalesce(trim(b.owner), '') <> ''
   or coalesce(trim(b.owner_phone), '') <> ''
   or coalesce(trim(b.owner_contact_note), '') <> ''
on conflict (business_id) do nothing;

drop trigger if exists businesses_mirror_owner_columns on public.businesses;
drop function if exists public.mirror_business_owner_columns();

alter table public.businesses
  drop column owner,
  drop column owner_phone,
  drop column owner_contact_note;
