-- Giro declarado por el propio dueño en la landing: comida o comercial.
--
-- No sustituye a `categories` (28 categorías, mucho más finas). Sirve para dos
-- cosas: en la landing decide qué ejemplos de offerings se le enseñan al dueño,
-- y en el admin acota de qué lado del catálogo buscar la categoría al aprobar.
--
-- Nullable: las solicitudes que ya están en la cola no lo traen.

alter table public.business_registrations
  add column giro text
    constraint business_registrations_giro_check
      check (giro in ('comida', 'comercial'));
