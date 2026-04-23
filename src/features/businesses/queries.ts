import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BusinessFilters } from './schema'
import type { Business, BusinessWithCategory, CategoryOption } from './types'

export async function getBusinesses(filters: BusinessFilters): Promise<BusinessWithCategory[]> {
  const supabase = await createClient()
  let query = supabase
    .from('businesses')
    .select('*, category:categories(id, name, type)')
    .order('created_at', { ascending: false })

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.category) query = query.eq('category_id', filters.category)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as BusinessWithCategory[]
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function getActiveCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getAllCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('id, name, type').order('name')
  if (error) throw error
  return data ?? []
}
