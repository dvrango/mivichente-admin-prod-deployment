import type { Business } from './types'

// Completitud del perfil de un negocio: campos clave que hacen útil una ficha
// de directorio. Reusable en cualquier vista (tabla, simulador, ficha).
// Verde = casi todo, amarillo = a medias, rojo = casi vacío.

export type CompletenessLevel = 'green' | 'yellow' | 'red'

/**
 * Lo mínimo que hay que traer de un negocio para medirlo. Es un subconjunto de
 * `Business` a propósito: las listas que sólo pintan el semáforo (ej. los
 * últimos negocios capturados en campo) no tienen por qué traer la fila entera.
 */
export type CompletenessInput = Pick<
  Business,
  | 'phone'
  | 'description'
  | 'photo_url'
  | 'address'
  | 'maps_url'
  | 'category_id'
  | 'offerings'
  | 'schedule'
  | 'facebook_url'
  | 'instagram_url'
> & {
  /** Si tiene filas en `business_hours`. Ver `hasSchedule`. */
  hasHours: boolean
}

/**
 * ÚNICA definición de "este negocio ya tiene horario", para el admin entero.
 *
 * El horario vive en dos lados: la tabla `business_hours` (el camino normal) y
 * el texto `businesses.schedule`, que el modo campo usa para los negocios que no
 * manejan horario ("previa cita", "a domicilio"). Cualquiera de los dos cuenta.
 *
 * Existía duplicada y mal: el semáforo miraba SÓLO el texto, así que un negocio
 * con sus 6 filas de horario bien capturadas salía como "falta: Horario"
 * (reproducido con Tacos Brayan Sucursal), mientras el gate de campo — que sí
 * miraba las dos fuentes — decía lo contrario en la misma pantalla.
 *
 * Que las dos representaciones existan es deuda conocida (ver mikitasks
 * `clcauvbzj`); mientras exista, la regla se lee de aquí y de ningún otro lado.
 */
export function hasSchedule(input: { schedule: string | null; hasHours: boolean }): boolean {
  return input.hasHours || !!input.schedule?.trim()
}

export type Completeness = {
  level: CompletenessLevel
  /** 0–1: fracción de campos clave presentes. */
  score: number
  /** Etiquetas de los campos que faltan. */
  missing: string[]
}

const FIELDS: { label: string; filled: (b: CompletenessInput) => boolean }[] = [
  { label: 'Teléfono', filled: (b) => !!b.phone?.trim() },
  { label: 'Descripción', filled: (b) => !!b.description?.trim() },
  { label: 'Foto', filled: (b) => !!b.photo_url?.trim() },
  { label: 'Ubicación', filled: (b) => !!b.address?.trim() || !!b.maps_url?.trim() },
  { label: 'Categoría', filled: (b) => !!b.category_id },
  { label: 'Productos/servicios', filled: (b) => b.offerings.length > 0 },
  { label: 'Horario', filled: hasSchedule },
  { label: 'Redes', filled: (b) => !!b.facebook_url?.trim() || !!b.instagram_url?.trim() },
]

export function getCompleteness(b: CompletenessInput): Completeness {
  const missing = FIELDS.filter((f) => !f.filled(b)).map((f) => f.label)
  const score = (FIELDS.length - missing.length) / FIELDS.length
  const level: CompletenessLevel = score >= 0.75 ? 'green' : score >= 0.4 ? 'yellow' : 'red'
  return { level, score, missing }
}
