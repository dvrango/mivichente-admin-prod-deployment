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

export type CategoryOption = Pick<Category, 'id' | 'name' | 'type'>

/** Categorías de un negocio para poblar el form de edición. */
export type BusinessCategoryIds = {
  primaryId: string | null
  secondaryIds: string[]
}

export type DayHours = { opens_at: string; closes_at: string }
export type WeeklyHours = Partial<Record<number, DayHours>>
