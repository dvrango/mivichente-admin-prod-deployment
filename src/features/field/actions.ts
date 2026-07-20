'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_PHOTOS_BUCKET, pathFromPublicUrl } from '@/lib/storage'
import { bulkSetPrimaryCategory } from '@/features/businesses/actions'
import { fieldCreateSchema, fieldPatchSchema, fieldPhotoSchema, photoKindSchema } from './schema'
import { PHOTO_KIND_LABELS } from './constants'
import type { FieldPhoto } from './queries'

// ─────────────────────────────────────────────────────────────────────────────
// Por qué existe este archivo en vez de reusar `businesses/actions.ts`:
//
// `updateBusiness` es un REEMPLAZO DE DOCUMENTO COMPLETO. Antes de insertar,
// hace `.delete()` sobre business_photos, business_hours, business_services y
// business_categories, y fija `photo_url = photos[0] ?? null`. Es lo correcto
// para el form de escritorio, que siempre manda el estado completo.
//
// Guardar campo por campo con esa acción BORRARÍA todas las fotos, horarios y
// servicios del negocio en cada tecla. Por eso el modo campo usa acciones
// aditivas y parciales. No sustituir por `updateBusiness`.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldActionResult = { error: string | null }

const OK: FieldActionResult = { error: null }

function firstIssue(err: import('zod').ZodError): string {
  return err.issues[0]?.message ?? 'Datos inválidos.'
}

async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Guarda un subconjunto de columnas escalares/array del negocio.
 *
 * Recibe un objeto plano, no FormData: por aquí no pasan archivos, así que no
 * toca el límite de 1 MB del body de los server actions.
 *
 * NO revalida la ruta de campo a propósito — re-renderizar el RSC mientras se
 * escribe pisaría el estado del componente cliente.
 */
export async function patchBusinessFields(id: string, patch: unknown): Promise<FieldActionResult> {
  const parsed = fieldPatchSchema.safeParse(patch)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (Object.keys(parsed.data).length === 0) return OK

  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({
      ...parsed.data,
      // Pasó por revisión humana en la calle (ver notas de data_source).
      data_source: 'admin',
      updated_by: await currentUserId(supabase),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/businesses')
  return OK
}

/**
 * Categoría primaria. Reusa `bulkSetPrimaryCategory`, que ya resuelve las dos
 * cosas no obvias: business_categories no tiene policy UPDATE en RLS (va con
 * delete+insert) y no puede quedar más de una primaria.
 *
 * Además deriva `services_label` del tipo de categoría, igual que hace el form
 * de escritorio al enviar (comida → "Menú").
 */
export async function setFieldPrimaryCategory(
  id: string,
  categoryId: string,
): Promise<FieldActionResult> {
  const result = await bulkSetPrimaryCategory([id], categoryId)
  if (result.error) return { error: result.error }

  const supabase = await createClient()
  const { data: category } = await supabase
    .from('categories')
    .select('type')
    .eq('id', categoryId)
    .single()

  await supabase
    .from('businesses')
    .update({ services_label: category?.type === 'food' ? 'Menú' : 'Servicios' })
    .eq('id', id)

  return OK
}

/**
 * Agrega una foto al final de la galería. ADITIVO — al revés que `upsertPhotos`,
 * nunca borra las que ya estaban. Si es la primera, también la denormaliza como
 * portada en `businesses.photo_url`.
 */
export async function addFieldPhoto(
  id: string,
  photo: unknown,
): Promise<{ error: string | null; photo: FieldPhoto | null }> {
  const parsed = fieldPhotoSchema.safeParse(photo)
  if (!parsed.success) return { error: firstIssue(parsed.error), photo: null }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('business_photos')
    .select('order_index')
    .eq('business_id', id)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIndex = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

  // El caption arranca como la etiqueta del kind (es lo que la app pinta encima
  // de la foto), pero después se puede editar libre desde el form de escritorio
  // sin afectar al `kind`, que es lo que consulta el pipeline de IA.
  const kind = parsed.data.kind
  const caption = kind === 'otro' ? null : PHOTO_KIND_LABELS[kind]

  const { data: inserted, error } = await supabase
    .from('business_photos')
    .insert({
      business_id: id,
      url: parsed.data.url,
      caption,
      kind,
      order_index: nextIndex,
    })
    .select('id, url, caption, kind, order_index')
    .single()
  if (error) return { error: error.message, photo: null }

  if (nextIndex === 0) {
    await supabase
      .from('businesses')
      .update({ photo_url: parsed.data.url, updated_by: await currentUserId(supabase) })
      .eq('id', id)
  }

  revalidatePath('/businesses')
  return { error: null, photo: inserted }
}

/** Reclasifica una foto ya subida (por si se disparó con el botón equivocado). */
export async function setFieldPhotoKind(
  photoId: string,
  kind: unknown,
): Promise<FieldActionResult> {
  const parsed = photoKindSchema.safeParse(kind)
  if (!parsed.success) return { error: 'Tipo de foto inválido.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('business_photos')
    .update({
      kind: parsed.data,
      caption: parsed.data === 'otro' ? null : PHOTO_KIND_LABELS[parsed.data],
    })
    .eq('id', photoId)
  if (error) return { error: error.message }
  return OK
}

/** Quita una foto: borra la fila, el archivo del bucket, y resincroniza la portada. */
export async function removeFieldPhoto(
  businessId: string,
  photoId: string,
): Promise<FieldActionResult> {
  const supabase = await createClient()

  // Leer la URL ANTES de borrar la fila, o se pierde el path a limpiar.
  const { data: photo } = await supabase
    .from('business_photos')
    .select('url')
    .eq('id', photoId)
    .single()

  const { error } = await supabase.from('business_photos').delete().eq('id', photoId)
  if (error) return { error: error.message }

  if (photo?.url) {
    const path = pathFromPublicUrl(photo.url)
    if (path) await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).remove([path])
  }

  await syncCoverPhoto(supabase, businessId)
  revalidatePath('/businesses')
  return OK
}

/** Manda una foto al frente (order_index 0) y la vuelve portada. Un solo toque. */
export async function setFieldCoverPhoto(
  businessId: string,
  photoId: string,
): Promise<FieldActionResult> {
  const supabase = await createClient()

  const { data: photos, error } = await supabase
    .from('business_photos')
    .select('id')
    .eq('business_id', businessId)
    .order('order_index')
  if (error) return { error: error.message }
  if (!photos) return OK

  const reordered = [photoId, ...photos.map((p) => p.id).filter((pid) => pid !== photoId)]

  // order_index no es único (sólo hay índice compuesto), así que los updates
  // secuenciales no chocan entre sí.
  for (const [index, pid] of reordered.entries()) {
    await supabase.from('business_photos').update({ order_index: index }).eq('id', pid)
  }

  await syncCoverPhoto(supabase, businessId)
  revalidatePath('/businesses')
  return OK
}

/** Deja `businesses.photo_url` igual a la foto de order_index más bajo. */
async function syncCoverPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
) {
  const { data } = await supabase
    .from('business_photos')
    .select('url')
    .eq('business_id', businessId)
    .order('order_index')
    .limit(1)

  await supabase
    .from('businesses')
    .update({
      photo_url: data && data.length > 0 ? data[0].url : null,
      updated_by: await currentUserId(supabase),
    })
    .eq('id', businessId)
}

export type FieldCreateResult = { error: string | null; id: string | null }

/**
 * Alta mínima desde la calle: nombre + teléfono (lo único que la DB exige).
 * El municipio sale del perfil del reviewer — nunca se teclea, y con municipio
 * null el insert fallaría por RLS (el layout ya bloquea ese caso antes).
 */
export async function createFieldBusiness(input: unknown): Promise<FieldCreateResult> {
  const parsed = fieldCreateSchema.safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error), id: null }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, municipio')
    .eq('id', (await currentUserId(supabase)) ?? '')
    .single()

  if (!profile) return { error: 'No se pudo resolver tu perfil.', id: null }
  if (profile.role !== 'admin' && !profile.municipio) {
    return { error: 'Tu usuario no tiene municipio asignado.', id: null }
  }

  const actorId = profile.id
  const { data: inserted, error } = await supabase
    .from('businesses')
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      phone_is_whatsapp: true,
      municipio: profile.municipio ?? 'Vicente Guerrero',
      // Arranca inactivo: se publica al terminar la visita (finishFieldVisit).
      is_active: false,
      data_source: 'admin',
      created_by: actorId,
      updated_by: actorId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message, id: null }

  revalidatePath('/businesses')
  return { error: null, id: inserted.id }
}

/** Publica el negocio al cerrar la visita. El gate de campos lo valida la UI. */
export async function finishFieldVisit(id: string): Promise<FieldActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({
      is_active: true,
      data_source: 'admin',
      updated_by: await currentUserId(supabase),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/businesses')
  revalidatePath('/campo')
  return OK
}

/**
 * Ofertas más comunes entre los negocios de la misma categoría, para las chips
 * de sugerencia. Sin RPC nueva: se agrega en memoria sobre una muestra chica.
 * Hoy devuelve poco (casi ningún negocio tiene offerings — ese es el problema
 * que este modo viene a resolver); mejora sola conforme se captura.
 */
export async function getOfferingSuggestions(categoryId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('businesses')
    .select('offerings')
    .eq('category_id', categoryId)
    .limit(300)

  const counts = new Map<string, { label: string; n: number }>()
  for (const row of data ?? []) {
    for (const raw of row.offerings ?? []) {
      const label = raw.trim()
      if (!label) continue
      const key = label.toLowerCase()
      const hit = counts.get(key)
      if (hit) hit.n += 1
      else counts.set(key, { label, n: 1 })
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map((c) => c.label)
}
