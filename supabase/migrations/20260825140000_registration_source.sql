-- De qué superficie llegó cada solicitud de registro.
--
-- Hasta ahora no había forma de saberlo. Se podía inferir —las que entraban por
-- el formulario de la app llegaban sin `giro` ni `offerings`, porque esa
-- pantalla nunca los preguntó— pero esa señal desaparece en cuanto las dos
-- superficies manden lo mismo, que es justo lo que se va a hacer.
--
-- Sin esta columna, después de unificar no habría contra qué comparar: no se
-- podría saber si mandar al usuario de la app al formulario web le costó
-- registros o se los ganó.
--
-- Vocabulario alineado con `business_contacts.source`, que ya usa 'app' y
-- 'landing' para lo mismo. No se inventa uno nuevo.

alter table public.business_registrations
  add column source text;

alter table public.business_registrations
  add constraint business_registrations_source_check
  check (source is null or source in ('landing', 'app'));

comment on column public.business_registrations.source is
  'Superficie por la que entró la solicitud: ''landing'' o ''app''. NULL en las
   41 solicitudes anteriores al 2026-08-25 — a propósito: no se rellenaron por
   inferencia. Quien quiera separarlas puede usar la heurística de que las de la
   app llegaban sin `giro` ni `offerings`, pero eso es una suposición y no debe
   quedar guardada como si fuera un dato.';

-- Lo que se va a medir es "cuántas por superficie en tal periodo", así que el
-- índice va junto con la fecha.
create index business_registrations_source_created_idx
  on public.business_registrations (source, created_at desc);
