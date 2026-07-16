-- business_photos: galería de fotos por negocio, cada una con título opcional.
--
-- El PRD pide "galería de fotos (mínimo 3, recomendado 5+): fachada, interior,
-- productos/servicios", pero el schema sólo tenía businesses.photo_url — una
-- sola foto y sin forma de titularla.
--
-- businesses.photo_url NO se elimina: se queda como denormalización de la
-- portada (la foto con order_index más bajo), mismo patrón que category_id
-- respecto de business_categories. Así siguen funcionando sin cambios los
-- consumidores que sólo necesitan una imagen: las cards de mobile, el
-- agrupamiento de "quick contacts" (photo_url null = negocio sin foto), el
-- mosaico y los OG tags del landing, y el indicador de completitud del admin.

create table public.business_photos (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- URL pública del bucket business-photos (ya es público; sirve igual para N).
  url         text not null,
  -- Título que se muestra encima de la foto ("Fachada", "Horno a leña").
  caption     text,
  -- Orden de la galería; el order_index 0 es la portada.
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Lookup por negocio: el perfil carga la galería completa ya ordenada.
create index business_photos_business_id_idx
  on public.business_photos (business_id, order_index);

-- RLS: mismo patrón que business_services / business_hours — anon sólo ve
-- fotos de negocios activos, authenticated (admin) tiene acceso total.
alter table public.business_photos enable row level security;

create policy "business_photos_public_read"
  on public.business_photos for select
  to anon
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_photos.business_id
        and b.is_active = true
    )
  );

create policy "business_photos_admin_all"
  on public.business_photos for all
  to authenticated
  using (true)
  with check (true);

-- Las policies no bastan sin el grant a nivel tabla.
grant select on public.business_photos to anon;
grant all on public.business_photos to authenticated;

-- Backfill: la foto actual de cada negocio se vuelve su portada. Sin caption
-- (nadie las tituló nunca) y sin pérdida — photo_url se queda intacto.
insert into public.business_photos (business_id, url, order_index)
select id, photo_url, 0
from public.businesses
where photo_url is not null and trim(photo_url) <> '';
