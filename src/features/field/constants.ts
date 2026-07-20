// Qué ES cada foto (`business_photos.kind`). No es lo mismo que el caption: el
// caption es el título que se muestra encima de la foto y es editable; el kind
// es la clasificación con la que el pipeline de IA encuentra las fotos de menú.
export const PHOTO_KINDS = ['fachada', 'interior', 'producto', 'menu', 'equipo', 'otro'] as const

export type PhotoKind = (typeof PHOTO_KINDS)[number]

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  fachada: 'Fachada',
  interior: 'Interior',
  producto: 'Producto',
  menu: 'Menú',
  equipo: 'Equipo',
  otro: 'Otra',
}

/** Los kinds que se pueden reasignar tocando un chip en el tile. */
export const SELECTABLE_PHOTO_KINDS: PhotoKind[] = [
  'fachada',
  'interior',
  'producto',
  'menu',
  'equipo',
]

/** Fotos recomendadas por el PRD. El gate de "visita terminada" sólo pide 1. */
export const PHOTO_TARGET_COUNT = 3

/** Lado largo al que se reescala antes de subir. */
export const PHOTO_TARGET_LONG_EDGE = 1600

/** Debounce por campo antes de guardar. El blur hace flush inmediato. */
export const FIELD_SAVE_DEBOUNCE_MS = 600

/** Debounce de la búsqueda. Más corto que el simulador: aquí hay prisa. */
export const FIELD_SEARCH_DEBOUNCE_MS = 250
