import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { BUSINESSES_PAGE_SIZE, type BusinessFilters } from './schema'
import type { Business, BusinessWithCategory, CategoryOption, WeeklyHours } from './types'

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

  let query = supabase
    .from('businesses')
    .select('*, category:categories(id, name, type)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.category) query = query.eq('category_id', filters.category)

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
