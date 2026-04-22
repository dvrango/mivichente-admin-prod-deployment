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

export type Business = {
  id: string
  name: string
  category_id: string | null
  phone: string
  address: string | null
  schedule: string | null
  photo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BusinessWithCategory = Business & {
  category: Pick<Category, 'id' | 'name' | 'type'> | null
}
