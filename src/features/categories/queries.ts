import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { CategoryFilters } from './schema'
import type { Category } from './types'

export async function getCategories(filters: CategoryFilters): Promise<Category[]> {
  const supabase = await createClient()
  let query = supabase.from('categories').select('*').order('created_at', { ascending: false })
  if (filters.type) query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}
