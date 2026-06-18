import type { Tables } from '@/lib/database.types'

export type Business = Tables<'businesses'>
export type Category = Tables<'categories'>

export type BusinessWithCategory = Business & {
  category: Pick<Category, 'id' | 'name' | 'type'> | null
}

export type CategoryOption = Pick<Category, 'id' | 'name' | 'type'>

export type DayHours = { opens_at: string; closes_at: string }
export type WeeklyHours = Partial<Record<number, DayHours>>
