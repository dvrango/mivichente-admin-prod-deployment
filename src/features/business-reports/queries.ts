import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { REPORTS_PAGE_SIZE, type ReportFilters } from './schema'
import type { BusinessReport } from './types'

export type ReportsPage = {
  rows: BusinessReport[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function getReports(filters: ReportFilters): Promise<ReportsPage> {
  const supabase = await createClient()
  const pageSize = REPORTS_PAGE_SIZE
  const from = (filters.page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('business_reports')
    .select('*, business:businesses(id, name, slug)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.reason) query = query.eq('reason', filters.reason)

  const { data, error, count } = await query

  if (error) throw error
  const total = count ?? 0
  return {
    rows: (data ?? []) as unknown as BusinessReport[],
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}
