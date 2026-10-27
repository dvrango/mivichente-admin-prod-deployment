import type { Tables } from '@/lib/database.types'
import type { MissingReportStatus } from './schema'

// `status` llega como text de la DB; el check constraint garantiza los tres
// valores, así que se estrecha aquí para que la UI no tenga que validarlo.
export type MissingBusinessReport = Omit<Tables<'missing_business_reports'>, 'status'> & {
  status: MissingReportStatus
}
