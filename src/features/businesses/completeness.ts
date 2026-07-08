import type { Business } from './types'

// Completitud del perfil de un negocio: campos clave que hacen útil una ficha
// de directorio. Reusable en cualquier vista (tabla, simulador, ficha).
// Verde = casi todo, amarillo = a medias, rojo = casi vacío.

export type CompletenessLevel = 'green' | 'yellow' | 'red'

export type Completeness = {
  level: CompletenessLevel
  /** 0–1: fracción de campos clave presentes. */
  score: number
  /** Etiquetas de los campos que faltan. */
  missing: string[]
}

const FIELDS: { label: string; filled: (b: Business) => boolean }[] = [
  { label: 'Teléfono', filled: (b) => !!b.phone?.trim() },
  { label: 'Descripción', filled: (b) => !!b.description?.trim() },
  { label: 'Foto', filled: (b) => !!b.photo_url?.trim() },
  { label: 'Ubicación', filled: (b) => !!b.address?.trim() || !!b.maps_url?.trim() },
  { label: 'Categoría', filled: (b) => !!b.category_id },
  { label: 'Productos/servicios', filled: (b) => b.offerings.length > 0 },
  { label: 'Horario', filled: (b) => !!b.schedule?.trim() },
  { label: 'Redes', filled: (b) => !!b.facebook_url?.trim() || !!b.instagram_url?.trim() },
]

export function getCompleteness(b: Business): Completeness {
  const missing = FIELDS.filter((f) => !f.filled(b)).map((f) => f.label)
  const score = (FIELDS.length - missing.length) / FIELDS.length
  const level: CompletenessLevel = score >= 0.75 ? 'green' : score >= 0.4 ? 'yellow' : 'red'
  return { level, score, missing }
}
