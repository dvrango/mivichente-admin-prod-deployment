import { z } from 'zod'

export const MISSING_REPORT_STATUSES = ['pending', 'resolved', 'dismissed'] as const
export type MissingReportStatus = (typeof MISSING_REPORT_STATUSES)[number]

export const MISSING_STATUS_LABELS: Record<MissingReportStatus, string> = {
  pending: 'Pendientes',
  resolved: 'Atendidos',
  dismissed: 'Descartados',
}

export const MISSING_REPORTS_PAGE_SIZE = 25

// Pendientes por default: es la bandeja de trabajo. Lo atendido y lo descartado
// se conserva (el término es el dato del levantamiento) pero no estorba.
export const missingReportFiltersSchema = z.object({
  status: z.enum(MISSING_REPORT_STATUSES).optional().default('pending'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type MissingReportFilters = z.infer<typeof missingReportFiltersSchema>

export const setMissingReportStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(MISSING_REPORT_STATUSES),
})
