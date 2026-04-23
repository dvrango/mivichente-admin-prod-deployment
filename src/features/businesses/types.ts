import type { Tables } from '@/lib/database.types'

export type Business = Tables<'businesses'>
export type Category = Tables<'categories'>

export type BusinessWithCategory = Business & {
  category: Pick<Category, 'id' | 'name' | 'type'> | null
}

export type CategoryOption = Pick<Category, 'id' | 'name' | 'type'>
