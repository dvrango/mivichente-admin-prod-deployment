import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { BUSINESSES_PAGE_SIZE, type BusinessFilters } from './schema'
import type {
  ActorProfile,
  Business,
  BusinessCategoryIds,
  BusinessWithCategory,
  CategoryOption,
  WeeklyHours,
} from './types'

export type BusinessesPage = {
  rows: BusinessWithCategory[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function getBusinesses(filters: BusinessFilters): Promise<BusinessesPage> {
  const supabase = await createClient()
  const pageSize = BUSINESSES_PAGE_SIZE
  const from = (filters.page - 1) * pageSize
  const to = from + pageSize - 1

  if (filters.q) {
    const { data, error } = await supabase
      .rpc('search_businesses', { search_query: filters.q })
      .select(
        '*, category:categories!businesses_category_id_fkey(id, name, type), created_by_profile:profiles!businesses_created_by_fkey(email), updated_by_profile:profiles!businesses_updated_by_fkey(email)',
      )
    if (error) throw error
    let rows = (data ?? []) as BusinessWithCategory[]
    // Filtro por categoría sobre el ≤50 de la RPC (no sólo la primaria):
    // se consulta business_categories acotado a esos ids en vez de traer
    // todos los negocios de la categoría.
    if (filters.category && rows.length > 0) {
      const { data: bcRows, error: bcError } = await supabase
        .from('business_categories')
        .select('business_id')
        .eq('category_id', filters.category)
        .in(
          'business_id',
          rows.map((r) => r.id),
        )
      if (bcError) throw bcError
      const idSet = new Set((bcRows ?? []).map((r) => r.business_id))
      rows = rows.filter((r) => idSet.has(r.id))
    }
    if (filters.status !== 'all') {
      const wantActive = filters.status === 'active'
      rows = rows.filter((r) => r.is_active === wantActive)
    }
    // Igual que el filtro de categoría de arriba: se aplica sobre el ≤50 que
    // devuelve search_businesses (ordenado por similitud), no sobre toda la
    // tabla. Con búsqueda activa un negocio del municipio X que quede fuera del
    // top-50 no aparece. Tradeoff aceptado — el municipio sin búsqueda sí va por
    // .eq() contra la tabla completa (rama de abajo).
    if (filters.municipio) {
      rows = rows.filter((r) => r.municipio === filters.municipio)
    }
    const total = rows.length
    const page = filters.page
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const sliced = rows.slice(from, to + 1)
    return { rows: sliced, total, page, pageSize, pageCount }
  }

  // Filtro por categoría: matchea si CUALQUIERA de las categorías del negocio
  // coincide (no sólo la primaria). Se resuelven primero los business_id que
  // tienen esa categoría en business_categories y luego se filtra por id.
  let categoryBusinessIds: string[] | null = null
  if (filters.category) {
    const { data: bcRows, error: bcError } = await supabase
      .from('business_categories')
      .select('business_id')
      .eq('category_id', filters.category)
    if (bcError) throw bcError
    categoryBusinessIds = [...new Set((bcRows ?? []).map((r) => r.business_id))]
  }

  let query = supabase
    .from('businesses')
    .select(
      '*, category:categories!businesses_category_id_fkey(id, name, type), created_by_profile:profiles!businesses_created_by_fkey(email), updated_by_profile:profiles!businesses_updated_by_fkey(email)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (categoryBusinessIds) query = query.in('id', categoryBusinessIds)
  if (filters.status !== 'all') query = query.eq('is_active', filters.status === 'active')
  if (filters.municipio) query = query.eq('municipio', filters.municipio)

  const { data, error, count } = await query
  if (error) throw error
  const total = count ?? 0
  return {
    rows: (data ?? []) as BusinessWithCategory[],
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export type BusinessWithAuthors = Business & {
  created_by_profile?: ActorProfile
  updated_by_profile?: ActorProfile
}

export async function getBusinessById(id: string): Promise<BusinessWithAuthors | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('businesses')
    .select(
      '*, created_by_profile:profiles!businesses_created_by_fkey(email), updated_by_profile:profiles!businesses_updated_by_fkey(email)',
    )
    .eq('id', id)
    .single()
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

export async function getBusinessCategoryIds(businessId: string): Promise<BusinessCategoryIds> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_categories')
    .select('category_id, is_primary')
    .eq('business_id', businessId)
  if (error) throw error
  const rows = data ?? []
  return {
    primaryId: rows.find((r) => r.is_primary)?.category_id ?? null,
    secondaryIds: rows.filter((r) => !r.is_primary).map((r) => r.category_id),
  }
}

export async function getBusinessHours(businessId: string): Promise<WeeklyHours> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_hours')
    .select('day_of_week, opens_at, closes_at')
    .eq('business_id', businessId)
  if (error) throw error
  const hours: WeeklyHours = {}
  for (const row of data ?? []) {
    hours[row.day_of_week] = {
      opens_at: row.opens_at.slice(0, 5),
      closes_at: row.closes_at.slice(0, 5),
    }
  }
  return hours
}
