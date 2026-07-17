-- Foto por servicio + etiqueta de la sección "Servicios" por negocio.
--
-- Motivación: entró el primer negocio de comida que manda su menú platillo por
-- platillo — cada uno con foto, nombre, precio y descripción. `business_services`
-- ya guarda nombre+precio+descripción (mismo shape que un platillo), pero le
-- faltaba dónde poner la foto del plato. En vez de una tabla `business_menu_items`
-- aparte (structura calcada), se reusa business_services: un platillo ES un
-- servicio con foto. El fork a un modelo de menú propio se hará sólo cuando haya
-- caso de uso real (secciones entradas/bebidas, variantes con precio,
-- disponibilidad on/off) — hoy no lo hay.
--
-- `services_label` deja que la sección se llame según el giro: "Menú" para
-- comida, "Servicios" (default) para el resto. Va en businesses, no en
-- business_services, porque es una etiqueta por-negocio, no por-fila.

-- Foto del servicio/platillo. Nullable: los servicios intangibles (una consulta
-- de nutrióloga) no llevan foto. Vive en el mismo bucket público
-- `business-photos` que la galería.
alter table public.business_services
  add column image_url text;

-- Título de la sección de servicios en el perfil. Nullable = sin personalizar;
-- el cliente cae a 'Servicios' por defecto. Se pone 'Menú' para negocios de comida.
alter table public.businesses
  add column services_label text;
