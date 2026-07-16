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
 * Servicio de un negocio tal como lo maneja el form. Todo string porque viaja
 * en un campo JSON del FormData y se teclea en inputs; el schema lo convierte
 * a numeric/null al guardar. El orden del array es el order_index.
 */
export type ServiceInput = { name: string; price: string; description: string }
