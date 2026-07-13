-- La landing de negocios pide ahora la lista de lo que vende el negocio: es el
-- dato que le falta a casi todos los que ya están cargados y sin el cual no
-- aparecen en las búsquedas (la búsqueda matchea contra businesses.offerings).
--
-- Dos cambios:
--   1. offerings: mismo tipo que businesses.offerings, para que el admin pueda
--      copiarlos tal cual al aprobar.
--   2. business_id: hasta ahora, cuando el dueño llegaba por el buscador y su
--      negocio YA existía, el vínculo se guardaba como texto libre dentro de
--      `notes`. Con FK real, el admin sabe contra qué registro empatar sin
--      parsear una cadena.
--
-- description pasa a nullable: en una solicitud de un negocio ya cargado, lo que
-- importa son los offerings, no que vuelva a describir su negocio.

alter table public.business_registrations
  add column offerings   text[] not null default '{}',
  add column business_id uuid references public.businesses(id) on delete set null;

alter table public.business_registrations
  alter column description drop not null;

create index business_registrations_business_id_idx
  on public.business_registrations (business_id);
