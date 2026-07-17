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
export type WeeklyHours = Partial<Record<number, DayHours>>

/**
 * Servicio de un negocio tal como lo maneja el form. name/price/description son
 * string porque viajan en un campo JSON del FormData y se teclean en inputs; el
 * schema convierte price a numeric/null al guardar. El orden del array es el
 * order_index.
 *
 * La foto sigue el mismo esquema que la galería: `imageUrl` = ya guardada en
 * storage; `imageFile` = nueva pendiente de subir; `imagePreviewUrl` es lo que
 * se pinta (URL pública u object URL local). Sin foto = las tres en null (los
 * servicios intangibles no llevan foto; los platillos de un menú sí).
 */
export type ServiceInput = {
  name: string
  price: string
  description: string
  imageUrl: string | null
  imageFile: File | null
  imagePreviewUrl: string | null
}

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
