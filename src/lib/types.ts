export type CategoryType = 'food' | 'business'

export type Category = {
  id: string
  name: string
  icon: string | null
  type: CategoryType
  is_active: boolean
  created_at: string
}

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  food: 'Comida',
  business: 'Negocios',
}
