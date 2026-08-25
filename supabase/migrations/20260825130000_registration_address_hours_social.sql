-- Dirección, horario y red social en la solicitud de registro.
--
-- Son los tres datos que hoy se persiguen por WhatsApp después de que el
-- negocio ya se registró. El razonamiento para pedirlos en el formulario en vez
-- de después: el momento del registro es el único en que el dueño tiene el
-- contexto abierto y ganas — ya decidió, ya está escribiendo. Tres días después,
-- por WhatsApp, se le pregunta a alguien a media chamba que contesta por
-- obligación, y muchos no contestan. Un campo más en un formulario que recibe
-- ~27 solicitudes al mes pesa menos que perseguir esas 27 una por una.
--
-- Todos opcionales, como el resto de lo que entra por aquí.

alter table public.business_registrations
  add column address    text,
  add column hours_note text,
  add column social_url text;

comment on column public.business_registrations.address is
  'Dirección en las palabras del dueño: calle y número, o una referencia del
   pueblo ("junto a la tienda de doña Mari"). Al aprobar se copia tal cual a
   businesses.address. No se geocodifica — el botón de ubicación de la app cae a
   una búsqueda de Google Maps por nombre + dirección, que con referencias
   locales funciona mejor que unas coordenadas mal puestas.';

comment on column public.business_registrations.hours_note is
  'Horario en texto libre ("9 a 6, domingos cerrado"). A propósito NO
   estructurado: business_hours son filas por día y soporta turnos partidos, y
   capturar eso en un formulario público es la parte más pesada de todas — se le
   pediría al dueño el trabajo que al admin le cuesta veinte segundos al
   aprobar. Este campo NO se mapea solo a ninguna columna de businesses: se
   muestra en el panel para que quien aprueba lo capture en el editor de
   horarios.';

comment on column public.business_registrations.social_url is
  'Facebook o Instagram, un solo campo. Se guarda como lo pegó el dueño y al
   aprobar se manda a businesses.facebook_url o instagram_url según el dominio:
   pedirle que distinga cuál es cuál sería fricción por nada.';
