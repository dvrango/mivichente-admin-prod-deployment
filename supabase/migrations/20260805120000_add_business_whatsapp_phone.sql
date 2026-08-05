-- Teléfono de WhatsApp distinto al de llamadas.
--
-- Trabajo de campo (2026-08-05): varios negocios usan un número para llamadas y
-- otro para WhatsApp. Hasta hoy sólo existía `phone` + `phone_is_whatsapp`
-- (bool = "este mismo número también tiene WhatsApp"), así que el segundo
-- número se metía a mano en la descripción.
--
-- Semántica después de esta migración:
--   * `phone`            -> siempre el número de LLAMADAS.
--   * `whatsapp_phone`   -> número de WhatsApp cuando es distinto. NULL = no hay
--                           uno aparte.
--   * `phone_is_whatsapp`-> sigue significando "`phone` también tiene WhatsApp".
--
-- Regla de lectura en clientes (mobile / landing):
--   número de WhatsApp  = whatsapp_phone ?? phone
--   ¿mostrar el botón?  = whatsapp_phone IS NOT NULL OR phone_is_whatsapp
-- Así los negocios de hoy (whatsapp_phone NULL) se comportan exactamente igual.

ALTER TABLE businesses
  ADD COLUMN whatsapp_phone TEXT;

COMMENT ON COLUMN businesses.whatsapp_phone IS
  'Número de WhatsApp cuando es distinto al de llamadas (businesses.phone). NULL = usar phone si phone_is_whatsapp.';
