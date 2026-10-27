import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { MISSING_REPORTS_PAGE_SIZE, type MissingReportFilters } from './schema'
import type { MissingBusinessReport } from './types'

export type MissingReportsPage = {
  rows: MissingBusinessReport[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function getMissingReports(
  filters: MissingReportFilters,
): Promise<MissingReportsPage> {
  const supabase = await createClient()
  const pageSize = MISSING_REPORTS_PAGE_SIZE
  const from = (filters.page - 1) * pageSize
  const to = from + pageSize - 1

  // `device_id` no se pide: la lista no lo usa, y no hace falta mandarlo al
  // cliente para revisar un aviso.
  const { data, error, count } = await supabase
    .from('missing_business_reports')
    .select('id, query, note, typed, status, reviewed_at, created_at', { count: 'exact' })
    .eq('status', filters.status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  const total = count ?? 0
  return {
    rows: (data ?? []) as MissingBusinessReport[],
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}
