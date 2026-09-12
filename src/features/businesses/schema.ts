import { z } from 'zod'
import { mxPhoneSchema, optionalMxPhoneSchema } from '@/lib/validation/phone'
import { SLUG_PATTERN, isReservedSlug, slugify } from '@/lib/slug'
import { PHOTO_MAX_BYTES, PHOTO_PICKER_MIME } from '@/lib/images/photo-limits'

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

// Camino de respaldo: el File llega crudo en el FormData, sin pasar por
// compressImage, así que acá sí se exige uno de los tres formatos del picker —
// los heic/heif que tolera el bucket sólo existen como fallback de la cámara.
// La subida normal es desde el browser y la valida `photoUploadRejection`.
export const photoFileSchema = z
  .custom<File>((v) => v instanceof File, 'Foto inválida')
  .refine((f) => f.size <= PHOTO_MAX_BYTES, 'La foto excede 5 MB.')
  .refine(
    (f) => (PHOTO_PICKER_MIME as readonly string[]).includes(f.type),
    'Formato inválido. Usa JPG, PNG o WEBP.',
  )

export const businessFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  // URL root-level tipo IG. Vacío = la DB lo autogenera del nombre (trigger).
  // Si se escribe, se normaliza y se valida contra formato + blocklist; la
  // unicidad final la garantiza la DB (índice único + trigger con sufijo).
  slug: z
    .string()
    .trim()
    .transform((v) => slugify(v))
    .refine((v) => v === '' || SLUG_PATTERN.test(v), 'Slug inválido.')
    .refine((v) => !isReservedSlug(v), 'Ese slug está reservado, elige otro.'),
  // Categoría primaria (denormalizada en businesses.category_id — la card
  // muestra este badge). Las secundarias viven sólo en business_categories.
  primary_category_id: z.string().uuid('La categoría principal es requerida.'),
  secondary_category_ids: z.array(z.string().uuid()).default([]),
  phone: mxPhoneSchema,
  phone_is_whatsapp: z.boolean(),
  // Número de WhatsApp cuando NO es el mismo que el de llamadas. Vacío → null y
  // el WhatsApp cae a `phone` (si `phone_is_whatsapp`), que es como se comportan
  // todos los negocios cargados hasta hoy.
  whatsapp_phone: optionalMxPhoneSchema,
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
  // Título de la sección de servicios en el perfil ("Menú" para comida,
  // default "Servicios"). Vacío → null (el cliente cae a "Servicios").
  services_label: z
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
  aliases: z.array(z.string().trim().min(1)),
  offerings: z.array(z.string().trim().min(1)),
  // Contacto interno de la campaña de campo: a quién se le habla DESPUÉS de la
  // visita (fotos, verificación, reclamar perfil). Nunca se muestra en la app.
  owner: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
  owner_phone: optionalMxPhoneSchema,
  owner_contact_note: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable(),
})

export type BusinessFormInput = z.infer<typeof businessFormSchema>

// NOTA (2026-09-02): acá vivían `serviceSchema` / `servicesSchema`, la
// validación de los servicios cuando viajaban dentro del FormData de este form.
// El menú ya no se guarda desde acá: su schema es
// `features/business-menu/schema.ts`, que valida UN ítem a la vez.
// `services_label` (arriba, el título "Menú"/"Servicios") sí sigue siendo del
// form: es un dato del negocio, no del menú.

// Galería (business_photos). Viaja como JSON con el orden final; cada entrada
// es una foto con `url` (ya guardada, o recién subida por el cliente antes de
// enviar el form) o un puntero `newIndex` al File `photo_new_{i}` del FormData.
// El camino normal hoy es el primero: el cliente comprime y sube directo a
// Storage, porque los server actions topan en 1 MB de body. El segundo se
// conserva como respaldo si el navegador no puede comprimir.
// El orden del array es el order_index, y la primera es la portada (se
// denormaliza en photo_url).
export const galleryPhotoSchema = z
  .object({
    url: z.string().trim().min(1).optional(),
    newIndex: z.number().int().min(0).optional(),
    // `true` = el cliente la acaba de subir en esta misma edición. Sirve para
    // borrarla del bucket si el guardado falla después.
    justUploaded: z.boolean().optional(),
    caption: z
      .string()
      .trim()
      .transform((v) => v || null),
  })
  .refine(
    (p) => (p.url !== undefined) !== (p.newIndex !== undefined),
    'Cada foto debe ser una existente o una nueva, no ambas.',
  )

export const gallerySchema = z.array(galleryPhotoSchema, { message: 'Fotos inválidas.' })

/** Galería validada: mezcla de fotos ya guardadas y punteros a archivos nuevos. */
export type GalleryValues = z.infer<typeof gallerySchema>

// Coordenadas. Viajan aparte del form principal (como horarios y galería)
// porque se teclean/pegan como texto y hay que dejarlas vaciar: string vacío =
// null, no 0. En modo campo las pone el GPS; en escritorio se pegan a mano o se
// extraen del `maps_url` que ya está guardado.
function coordinateSchema(limit: number, message: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && Math.abs(v) <= limit), message)
}

export const coordinatesSchema = z.object({
  latitude: coordinateSchema(90, 'Latitud inválida.'),
  longitude: coordinateSchema(180, 'Longitud inválida.'),
})

export type CoordinatesInput = z.infer<typeof coordinatesSchema>

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const dayHoursSchema = z.object({
  opens_at: z.string().regex(HHMM, 'Hora de apertura inválida.'),
  closes_at: z.string().regex(HHMM, 'Hora de cierre inválida.'),
})

/**
 * Horario semanal: llaves '0'–'6' (domingo = 0, igual que `extract(dow)`).
 * El valor es la lista de TURNOS del día — dos turnos = horario partido.
 * Se topa en 2 a propósito: en campo no ha aparecido un negocio con tres, y el
 * límite evita que un bug de UI escriba una lista infinita.
 */
export const weeklyHoursSchema = z.record(
  z.string().regex(/^[0-6]$/, 'Día inválido.'),
  z
    .array(dayHoursSchema)
    .min(1, 'El día necesita al menos un turno.')
    .max(2, 'Máximo 2 turnos por día.'),
)

export const BUSINESSES_PAGE_SIZE = 20

export const BUSINESS_STATUS_VALUES = ['all', 'active', 'inactive'] as const
export type BusinessStatus = (typeof BUSINESS_STATUS_VALUES)[number]

// Progreso de curación del scraping inicial. "Sin revisar" = data_source
// 'scraping' (nadie guardó el form); al editar la ficha flip a 'admin'.
export const BUSINESS_REVIEW_VALUES = ['all', 'pending', 'reviewed'] as const
export type BusinessReview = (typeof BUSINESS_REVIEW_VALUES)[number]

export const BUSINESS_VERIFIED_VALUES = ['all', 'yes'] as const
export type BusinessVerified = (typeof BUSINESS_VERIFIED_VALUES)[number]

// Menú = negocio de comida (categoría primaria con type 'food') con al menos un
// servicio cargado en `business_services`; es lo que se imprime en el QR
// (vichente.com/<slug>/menu). Los negocios que NO son de comida quedan fuera de
// 'with' y de 'without': no les aplica tener menú, así que meterlos en "sin
// menú" inflaría la lista de pendientes con negocios que nunca van a cargarlo.
export const BUSINESS_MENU_VALUES = ['all', 'with', 'without'] as const
export type BusinessMenu = (typeof BUSINESS_MENU_VALUES)[number]

export const businessFiltersSchema = z.object({
  q: z.string().trim().optional().default(''),
  category: z.string().trim().optional().default(''),
  status: z.enum(BUSINESS_STATUS_VALUES).optional().default('all'),
  review: z.enum(BUSINESS_REVIEW_VALUES).optional().default('all'),
  verified: z.enum(BUSINESS_VERIFIED_VALUES).optional().default('all'),
  menu: z.enum(BUSINESS_MENU_VALUES).optional().default('all'),
  // Sólo lo usa el admin (el reviewer ya queda acotado por RLS a su municipio).
  municipio: z.string().trim().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type BusinessFilters = z.infer<typeof businessFiltersSchema>

// Cambio de categoría primaria en lote desde la lista de negocios.
export const bulkCategorySchema = z.object({
  businessIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un negocio.'),
  categoryId: z.string().uuid('Categoría inválida.'),
})

export type BulkCategoryInput = z.infer<typeof bulkCategorySchema>

// Acciones bulk que sólo necesitan la lista de ids (activar, recomendar, eliminar).
export const bulkIdsSchema = z.array(z.string().uuid()).min(1, 'Selecciona al menos un negocio.')

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
    slug: formData.get('slug') ?? '',
    primary_category_id: primary,
    // Nunca dejar la primaria dentro de las secundarias (evita fila duplicada).
    secondary_category_ids: secondaryRaw.filter((c) => c !== primary),
    phone: formData.get('phone'),
    phone_is_whatsapp: formData.get('phone_is_whatsapp') === 'true',
    whatsapp_phone: formData.get('whatsapp_phone') ?? '',
    address: formData.get('address') ?? '',
    maps_url: formData.get('maps_url') ?? '',
    municipio: formData.get('municipio') ?? 'Vicente Guerrero',
    colonia: formData.get('colonia') ?? '',
    description: formData.get('description') ?? '',
    services_label: formData.get('services_label') ?? '',
    facebook_url: formData.get('facebook_url') ?? '',
    instagram_url: formData.get('instagram_url') ?? '',
    aliases: parseJsonArray(formData, 'aliases'),
    offerings: parseJsonArray(formData, 'offerings'),
    owner: formData.get('owner') ?? '',
    owner_phone: formData.get('owner_phone') ?? '',
    owner_contact_note: formData.get('owner_contact_note') ?? '',
  }
  return businessFormSchema.safeParse(raw)
}

export function parseCoordinates(formData: FormData) {
  return coordinatesSchema.safeParse({
    latitude: formData.get('latitude') ?? '',
    longitude: formData.get('longitude') ?? '',
  })
}
