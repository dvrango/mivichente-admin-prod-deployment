import type { Tables } from '@/lib/database.types'

export type Category = Tables<'categories'>
export type CategoryType = Category['type']

export const CATEGORY_TYPES = ['food', 'business'] as const

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  food: 'Comida',
  business: 'Negocios',
}
