import { z } from 'zod'

export const REPORT_REASONS = ['cerrado', 'datos_incorrectos', 'duplicado', 'spam', 'otro'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REASON_LABELS: Record<ReportReason, string> = {
  cerrado: 'Negocio cerrado',
  datos_incorrectos: 'Datos incorrectos',
  duplicado: 'Duplicado',
  spam: 'Spam',
  otro: 'Otro',
}

export const REPORTS_PAGE_SIZE = 25

export const reportFiltersSchema = z.object({
  reason: z.enum(REPORT_REASONS).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type ReportFilters = z.infer<typeof reportFiltersSchema>
