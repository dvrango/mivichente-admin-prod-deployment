-- Dueño y contacto operativo del negocio.
--
-- El dato más valioso de la campaña de campo es a quién le hablas DESPUÉS de la
-- visita (fotos, verificación, reclamar perfil). Hasta ahora sólo se guardaba
-- `businesses.phone`, que es el teléfono público del negocio.
--
-- `owner_contact_note` es texto libre corto a propósito ("hija del dueño, lleva
-- el FB"): en la calle se descubrió que el dueño casi nunca es quien contesta
-- WhatsApp, pero la evidencia es de un puñado de negocios. Desdoblarlo en
-- "contacto digital + su teléfono" espera a ver el patrón con datos reales.
--
-- Ninguna de las tres se expone en la app pública: son datos de contacto
-- interno. La policy de lectura anónima ya devuelve la fila completa, así que
-- el cliente móvil simplemente no las selecciona (`.select()` explícito).
alter table businesses
  add column if not exists owner text,
  add column if not exists owner_phone text,
  add column if not exists owner_contact_note text;

comment on column businesses.owner is 'Nombre del dueño del negocio. Uso interno (campaña de campo), no se muestra en la app.';
comment on column businesses.owner_phone is 'Teléfono de contacto del dueño/encargado, 10 dígitos sin formato. Uso interno.';
comment on column businesses.owner_contact_note is 'Quién es el contacto real ("hija del dueño, lleva el FB"). Texto libre corto.';
