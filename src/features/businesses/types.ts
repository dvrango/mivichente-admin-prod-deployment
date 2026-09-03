import type { Tables } from '@/lib/database.types'

export type Business = Tables<'businesses'>
export type Category = Tables<'categories'>

export type ActorProfile = { email: string | null } | null

export type BusinessWithCategory = Business & {
  category: Pick<Category, 'id' | 'name' | 'type'> | null
  // Perfil de quién creó/modificó. null si el actor ya no existe o (para un
  // reviewer) si no puede leer ese perfil por RLS.
  created_by_profile?: ActorProfile
  updated_by_profile?: ActorProfile
}

export type CategoryOption = Pick<Category, 'id' | 'name' | 'type' | 'aliases'>

/** Categorías de un negocio para poblar el form de edición. */
export type BusinessCategoryIds = {
  primaryId: string | null
  secondaryIds: string[]
}

export type DayHours = { opens_at: string; closes_at: string }

/**
 * Horario semanal por día (0=Dom … 6=Sáb). Cada día es una LISTA de turnos:
 * más de uno = horario partido (abre en la mañana, cierra a comer, reabre en la
 * tarde), que es lo normal en media plaza. Día ausente o lista vacía = cerrado.
 *
 * El orden del array es el orden en que se pinta y se guarda; los turnos se
 * ordenan por `opens_at` al leerlos de la DB.
 */
export type WeeklyHours = Partial<Record<number, DayHours[]>>

// NOTA (2026-09-02): acá vivía `ServiceInput`, la forma de un servicio dentro
// del form del negocio. El menú ya no se edita ahí: su tipo es `MenuItem`
// (features/business-menu/queries.ts), que trae el `id` de la fila porque el
// editor nuevo direcciona ítems en vez de reemplazar el menú completo.

/**
 * Foto de la galería en el form. `url` = ya guardada en storage; `file` = nueva,
 * pendiente de subir (exactamente una de las dos). `previewUrl` es lo que se
 * pinta (la URL pública o un object URL local). El orden del array es el
 * order_index, y la primera es la portada.
 */
export type PhotoInput = {
  url: string | null
  file: File | null
  previewUrl: string
  caption: string
}
