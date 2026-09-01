-- business_services: 2º eje de visibilidad, independiente de is_published.
--
-- Motivación: menú de mesa (landing, QR en la mesa) y perfil del negocio
-- (Flutter, "pide por teléfono/WhatsApp") muestran hoy exactamente los mismos
-- ítems — is_published es el único filtro y aplica a las dos superficies por
-- igual. Un menú completo (bar, bebidas, extras) tiene sentido completo en la
-- mesa pero no en el perfil: nadie pide un tequila por WhatsApp.
--
-- `show_in_profile` default true: no rompe el comportamiento actual de los
-- ~26 negocios con business_services ya cargados — todo sigue saliendo en el
-- perfil tal cual. Opt-out: el admin apaga los ítems que no aplican a pedido
-- a distancia (bar, bebidas, extras de mesa), no tiene que prender cada
-- platillo real uno por uno.
--
-- El menú de mesa NO se filtra por esta columna — sigue mostrando todo lo
-- publicado, es su superconjunto por diseño.
--
-- Va en el query del cliente, no en RLS: la policy no puede distinguir si
-- quien pregunta es el landing (menú de mesa) o la app (perfil), así que no
-- hay forma de tener dos comportamientos de lectura pública en una sola
-- policy. `business_services_public_read` no cambia.

alter table public.business_services
  add column show_in_profile boolean not null default true;

comment on column public.business_services.show_in_profile is
  'Si es false, el ítem no sale en el perfil del negocio (Flutter) aunque esté publicado y sí aparezca en el menú de mesa. El menú de mesa nunca filtra por esta columna.';
