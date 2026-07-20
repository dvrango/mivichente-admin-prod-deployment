import { z } from 'zod'
import { mxPhoneSchema } from '@/lib/validation/phone'
import { businessFormSchema } from '@/features/businesses/schema'
import { PHOTO_KINDS } from './constants'

// Campos que el modo campo puede escribir uno por uno. Se derivan del schema del
// form de escritorio para que la validación nunca se desincronice entre los dos.
//
// La lista es a propósito un whitelist: `municipio`, `slug`, `is_active`,
// `is_verified` y `data_source` NO se pueden tocar desde aquí. Junto con RLS es
// la frontera de seguridad de `patchBusinessFields`.
export const fieldPatchSchema = businessFormSchema
  .pick({
    name: true,
    phone: true,
    phone_is_whatsapp: true,
    address: true,
    maps_url: true,
    colonia: true,
    description: true,
    facebook_url: true,
    instagram_url: true,
    offerings: true,
    aliases: true,
  })
  .partial()
  // Coordenadas: no viven en `businessFormSchema` porque el form de escritorio
  // no las captura — sólo salen del GPS del celular en el modo campo.
  .extend({
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    location_accuracy_m: z.number().min(0).nullable().optional(),
  })

export type FieldPatch = z.infer<typeof fieldPatchSchema>
export type FieldPatchKey = keyof FieldPatch

// Alta mínima desde la calle: sólo lo que la DB exige (`businesses.phone` es
// NOT NULL). Todo lo demás se llena después en la pantalla de captura.
export const fieldCreateSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  phone: mxPhoneSchema,
})

export type FieldCreateInput = z.infer<typeof fieldCreateSchema>

export const photoKindSchema = z.enum(PHOTO_KINDS)

export const fieldPhotoSchema = z.object({
  url: z.string().trim().url('URL de foto inválida.'),
  kind: photoKindSchema.default('otro'),
})
