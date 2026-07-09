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

export type CategoryTerm = { id: string; name: string; aliases: string[] }

// Nombres + aliases de todas las categorías, para detectar duplicados al crear
// o editar una categoría (el formulario avisa si el nombre ya existe como
// nombre o alias de otra).
export async function getCategoryTerms(): Promise<CategoryTerm[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('id, name, aliases')
  if (error) throw error
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] }))
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
