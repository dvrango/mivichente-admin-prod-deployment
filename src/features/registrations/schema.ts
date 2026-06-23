import { z } from 'zod'

export const REGISTRATION_STATUSES = ['pending', 'reviewed', 'approved', 'rejected'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: 'Pendiente',
  reviewed: 'Revisado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export const REGISTRATIONS_PAGE_SIZE = 25

export const registrationFiltersSchema = z.object({
  status: z.enum(REGISTRATION_STATUSES).optional().default('pending'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type RegistrationFilters = z.infer<typeof registrationFiltersSchema>

export const updateRegistrationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REGISTRATION_STATUSES),
  notes: z.string().trim().optional(),
})

export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>
