import { z } from 'zod'
import { CATEGORY_TYPES } from './types'

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  icon: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  type: z.enum(CATEGORY_TYPES, { message: 'Tipo inválido.' }),
})

export type CategoryFormInput = z.infer<typeof categoryFormSchema>

export const categoryFiltersSchema = z.object({
  type: z.enum(CATEGORY_TYPES).nullable().default(null),
})

export type CategoryFilters = z.infer<typeof categoryFiltersSchema>

export function parseCategoryFilters(raw: { type?: string }): CategoryFilters {
  const parsed = categoryFiltersSchema.safeParse({
    type: raw.type && (CATEGORY_TYPES as readonly string[]).includes(raw.type) ? raw.type : null,
  })
  return parsed.success ? parsed.data : { type: null }
}

export function parseCategoryForm(formData: FormData) {
  return categoryFormSchema.safeParse({
    name: formData.get('name'),
    icon: formData.get('icon') ?? '',
    type: formData.get('type'),
  })
}
