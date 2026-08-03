-- business_services: secciones del menú y fecha de actualización.
--
-- Los dos huecos que la vista de menú en la mesa necesita y la tabla no tenía:
--
-- 1. `section` — en el menú de mesa las secciones (bebidas vs. elotes) son la
--    navegación de arriba, no un adorno. Hoy solo hay `order_index`, que ordena
--    pero no agrupa. Nullable a propósito: un negocio sin secciones se renderiza
--    como lista plana, así que capturar secciones no bloquea el arranque.
-- 2. `updated_at` — un precio en la mesa vale por lo fresco que esté. El menú lo
--    mantenemos nosotros a mano en esta etapa, así que la desactualización es
--    cuestión de tiempo, no de si pasa: quien está sentado tiene que poder ver
--    qué tan viejo es el precio que está leyendo.

alter table public.business_services
  add column section    text,
  add column updated_at timestamptz not null default now();

comment on column public.business_services.section is
  'Sección del menú a la que pertenece el platillo (ej. "Elotes", "Bebidas"). Null = el negocio no tiene secciones y su menú se muestra como lista plana.';
comment on column public.business_services.updated_at is
  'Última edición del platillo. Alimenta la fecha visible al pie del menú de mesa.';

-- Sin esto, la migración le pondría "actualizado hoy" a todo el catálogo — que
-- es justo la mentira que la fecha visible existe para evitar.
update public.business_services set updated_at = created_at;

create trigger business_services_set_updated_at
  before update on public.business_services
  for each row execute function public.set_updated_at();

create index business_services_section_idx
  on public.business_services (business_id, section, order_index);
