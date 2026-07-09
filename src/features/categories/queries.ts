import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { normalizeText } from '@/lib/normalize'
import type { CategoryFilters } from './schema'
import type { Category } from './types'

export async function getCategories(filters: CategoryFilters): Promise<Category[]> {
  const supabase = await createClient()
  let query = supabase.from('categories').select('*').order('created_at', { ascending: false })
  if (filters.type) query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw error
  const categories = data ?? []

  // Búsqueda por nombre o alias, normalizada (sin acentos/mayúsculas). El
  // catálogo es pequeño, así que filtrar en memoria es suficiente y evita armar
  // un OR sobre el array de aliases en Postgres.
  const term = normalizeText(filters.q)
  if (!term) return categories
  return categories.filter(
    (c) =>
      normalizeText(c.name).includes(term) ||
      (c.aliases ?? []).some((a) => normalizeText(a).includes(term)),
  )
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
