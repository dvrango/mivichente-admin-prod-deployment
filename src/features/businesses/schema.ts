import { z } from 'zod'
import { mxPhoneSchema } from '@/lib/validation/phone'

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

const photoSchema = z
  .custom<File | null>((v) => v === null || v instanceof File, 'Foto inválida')
  .refine((f) => !f || f.size <= PHOTO_MAX_BYTES, 'La foto excede 5 MB.')
  .refine(
    (f) => !f || (PHOTO_ALLOWED_MIME as readonly string[]).includes(f.type),
    'Formato inválido. Usa JPG, PNG o WEBP.',
  )

export const businessFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  category_id: z.string().uuid('La categoría es requerida.'),
  phone: mxPhoneSchema,
  address: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  schedule: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  photo: photoSchema,
})

export type BusinessFormInput = z.infer<typeof businessFormSchema>

export const BUSINESSES_PAGE_SIZE = 20

export const businessFiltersSchema = z.object({
  q: z.string().trim().optional().default(''),
  category: z.string().trim().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type BusinessFilters = z.infer<typeof businessFiltersSchema>

export function parseBusinessForm(formData: FormData) {
  const raw = {
    name: formData.get('name'),
    category_id: formData.get('category_id'),
    phone: formData.get('phone'),
    address: formData.get('address') ?? '',
    schedule: formData.get('schedule') ?? '',
    photo: (() => {
      const p = formData.get('photo')
      return p instanceof File && p.size > 0 ? p : null
    })(),
  }
  return businessFormSchema.safeParse(raw)
}
