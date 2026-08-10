-- business_services: control manual de publicación por platillo/servicio.
--
-- Motivación: hoy un servicio aparece en la app en cuanto se guarda desde el
-- admin, sin importar si el menú se está armando todavía o está incompleto.
-- No hay forma de ocultarlo mientras se termina de capturar.
--
-- `is_published` default true: no rompe el comportamiento actual de los
-- servicios ya existentes (todos siguen visibles tal cual). El toggle es
-- opt-out, no opt-in — el admin lo apaga mientras arma el platillo, no tiene
-- que prender cada uno al terminar.

alter table public.business_services
  add column is_published boolean not null default true;

comment on column public.business_services.is_published is
  'Si es false, el servicio/platillo no se muestra en la app aunque el negocio esté activo. Control manual desde el admin para ocultar mientras se arma el menú.';

-- RLS: mismo negocio-activo de antes, más el nuevo flag. authenticated (admin)
-- no cambia — sigue viendo todo, publicado o no.
drop policy "business_services_public_read" on public.business_services;

create policy "business_services_public_read"
  on public.business_services for select
  to anon
  using (
    is_published = true
    and exists (
      select 1 from public.businesses b
      where b.id = business_services.business_id
        and b.is_active = true
    )
  );
