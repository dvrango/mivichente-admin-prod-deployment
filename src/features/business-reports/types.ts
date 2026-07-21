import type { ReportReason } from './schema'

export type BusinessReport = {
  id: string
  business_id: string
  reason: ReportReason
  note: string | null
  created_at: string
  business: { id: string; name: string; slug: string } | null
}
