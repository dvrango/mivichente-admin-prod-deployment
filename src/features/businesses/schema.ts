import { z } from 'zod'
import { mxPhoneSchema } from '@/lib/validation/phone'

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

// data_source no se edita desde el form: scraping/self_registered los pone un proceso
// externo (script de scraping / auto-registro en la app); el admin panel siempre crea
// negocios con data_source = 'admin' (ver actions.ts -> createBusiness).
export const DATA_SOURCES = ['scraping', 'self_registered', 'admin'] as const

export const MUNICIPIOS = [
  'Vicente Guerrero',
  'Suchil',
  'Villa Unión',
  'Nombre de Dios',
  'Sombrerete',
  'Otro',
] as const
export type Municipio = (typeof MUNICIPIOS)[number]
export type DataSource = (typeof DATA_SOURCES)[number]

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  scraping: 'Scraping',
  self_registered: 'Autónomo',
  admin: 'Admin',
}

const photoSchema = z
  .custom<File | null>((v) => v === null || v instanceof File, 'Foto inválida')
  .refine((f) => !f || f.size <= PHOTO_MAX_BYTES, 'La foto excede 5 MB.')
  .refine(
    (f) => !f || (PHOTO_ALLOWED_MIME as readonly string[]).includes(f.type),
    'Formato inválido. Usa JPG, PNG o WEBP.',
  )

export const businessFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  // Categoría primaria (denormalizada en businesses.category_id — la card
  // muestra este badge). Las secundarias viven sólo en business_categories.
  primary_category_id: z.string().uuid('La categoría principal es requerida.'),
  secondary_category_ids: z.array(z.string().uuid()).default([]),
  phone: mxPhoneSchema,
  phone_is_whatsapp: z.boolean(),
  address: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  maps_url: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  municipio: z.enum(MUNICIPIOS, { message: 'Municipio inválido.' }),
  colonia: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  description: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  facebook_url: z
    .literal('')
    .transform(() => null)
    .or(z.string().trim().url('URL de Facebook inválida.'))
    .nullable(),
  instagram_url: z
    .literal('')
    .transform(() => null)
    .or(z.string().trim().url('URL de Instagram inválida.'))
    .nullable(),
  photo: photoSchema,
  aliases: z.array(z.string().trim().min(1)),
  offerings: z.array(z.string().trim().min(1)),
})

export type BusinessFormInput = z.infer<typeof businessFormSchema>

export const BUSINESSES_PAGE_SIZE = 20

export const BUSINESS_STATUS_VALUES = ['all', 'active', 'inactive'] as const
export type BusinessStatus = (typeof BUSINESS_STATUS_VALUES)[number]

export const businessFiltersSchema = z.object({
  q: z.string().trim().optional().default(''),
  category: z.string().trim().optional().default(''),
  status: z.enum(BUSINESS_STATUS_VALUES).optional().default('all'),
  // Sólo lo usa el admin (el reviewer ya queda acotado por RLS a su municipio).
  municipio: z.string().trim().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type BusinessFilters = z.infer<typeof businessFiltersSchema>

function parseJsonArray(formData: FormData, key: string): string[] {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function parseBusinessForm(formData: FormData) {
  const secondaryRaw = parseJsonArray(formData, 'secondary_category_ids')
  const primary = formData.get('primary_category_id')
  const raw = {
    name: formData.get('name'),
    primary_category_id: primary,
    // Nunca dejar la primaria dentro de las secundarias (evita fila duplicada).
    secondary_category_ids: secondaryRaw.filter((c) => c !== primary),
    phone: formData.get('phone'),
    phone_is_whatsapp: formData.get('phone_is_whatsapp') === 'true',
    address: formData.get('address') ?? '',
    maps_url: formData.get('maps_url') ?? '',
    municipio: formData.get('municipio') ?? 'Vicente Guerrero',
    colonia: formData.get('colonia') ?? '',
    description: formData.get('description') ?? '',
    facebook_url: formData.get('facebook_url') ?? '',
    instagram_url: formData.get('instagram_url') ?? '',
    photo: (() => {
      const p = formData.get('photo')
      return p instanceof File && p.size > 0 ? p : null
    })(),
    aliases: parseJsonArray(formData, 'aliases'),
    offerings: parseJsonArray(formData, 'offerings'),
  }
  return businessFormSchema.safeParse(raw)
}
