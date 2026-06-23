import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { REGISTRATIONS_PAGE_SIZE, type RegistrationFilters } from './schema'
import type { BusinessRegistration } from './types'

export type RegistrationsPage = {
  rows: BusinessRegistration[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function getRegistrations(filters: RegistrationFilters): Promise<RegistrationsPage> {
  const supabase = await createClient()
  const pageSize = REGISTRATIONS_PAGE_SIZE
  const from = (filters.page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('business_registrations')
    .select('*', { count: 'exact' })
    .eq('status', filters.status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  const total = count ?? 0
  return {
    rows: (data ?? []) as BusinessRegistration[],
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getRegistrationById(id: string): Promise<BusinessRegistration | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_registrations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as BusinessRegistration
}
