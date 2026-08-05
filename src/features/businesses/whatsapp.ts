/**
 * "¿Por dónde le escribo a este negocio?" — una sola pregunta con tres
 * respuestas excluyentes, compartida por el form de escritorio y el modo campo.
 *
 * Antes eran dos controles sueltos (checkbox "el teléfono tiene WhatsApp" +
 * campo "WhatsApp si es otro número") que contestaban lo mismo y podían
 * contradecirse: palomeado Y con otro número escrito, el cliente sólo pinta un
 * botón y había que adivinar cuál ganaba. Las tres opciones de aquí no se
 * pueden combinar.
 *
 * Mapeo a las columnas reales (`businesses`):
 *
 * | Opción     | phone_is_whatsapp | whatsapp_phone | Botón de WhatsApp va a |
 * |------------|-------------------|----------------|------------------------|
 * | `ninguno`  | false             | null           | no se muestra          |
 * | `mismo`    | true              | null           | `phone`                |
 * | `otro`     | false             | el 2º número   | `whatsapp_phone`       |
 *
 * `phone` nunca cambia de significado: siempre es la línea de llamadas.
 */
export const WHATSAPP_MODES = [
  { value: 'ninguno', label: 'No tiene' },
  { value: 'mismo', label: 'El mismo teléfono' },
  { value: 'otro', label: 'Otro número' },
] as const

export type WhatsappMode = (typeof WHATSAPP_MODES)[number]['value']

/** Deriva la opción a mostrar desde lo que ya está guardado en la DB. */
export function initialWhatsappMode(
  whatsappPhone: string | null | undefined,
  phoneIsWhatsapp: boolean | null | undefined,
): WhatsappMode {
  if (whatsappPhone) return 'otro'
  return phoneIsWhatsapp ? 'mismo' : 'ninguno'
}
