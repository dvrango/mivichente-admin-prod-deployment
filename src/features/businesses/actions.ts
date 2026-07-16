'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/features/auth/queries'
import {
  bulkCategorySchema,
  bulkIdsSchema,
  gallerySchema,
  parseBusinessForm,
  photoFileSchema,
  servicesSchema,
  type GalleryValues,
  type ServiceValues,
} from './schema'
import type { WeeklyHours } from './types'

export type BusinessFormState = { error: string | null }

const BUCKET = 'business-photos'

function parseHours(formData: FormData): WeeklyHours {
  const raw = formData.get('hours')
  if (typeof raw !== 'string' || !raw) return {}
  try {
    return JSON.parse(raw) as WeeklyHours
  } catch {
    return {}
  }
}

async function upsertHours(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  hours: WeeklyHours,
) {
  await supabase.from('business_hours').delete().eq('business_id', businessId)
  const rows = Object.entries(hours)
    .filter(([, h]) => !!h)
    .map(([day, h]) => ({
      business_id: businessId,
      day_of_week: Number(day),
      opens_at: h!.opens_at,
      closes_at: h!.closes_at,
    }))
  if (rows.length > 0) {
    const { error } = await supabase.from('business_hours').insert(rows)
    if (error) throw new Error(error.message)
  }
}

function parseServices(formData: FormData) {
  const raw = formData.get('services')
  if (typeof raw !== 'string' || !raw.trim()) return servicesSchema.safeParse([])
  let json: unknown = null
  try {
    json = JSON.parse(raw)
  } catch {
    // json queda null -> el schema falla con "Servicios inválidos."
  }
  return servicesSchema.safeParse(json)
}

// Delete-all-then-insert, igual que upsertHours. order_index = posición en el
// array que mandó el form, así el admin controla el orden de despliegue.
async function upsertServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  services: ServiceValues,
) {
  await supabase.from('business_services').delete().eq('business_id', businessId)
  const rows = services.map((s, i) => ({
    business_id: businessId,
    name: s.name,
    price: s.price,
    description: s.description,
    order_index: i,
  }))
  if (rows.length > 0) {
    const { error } = await supabase.from('business_services').insert(rows)
    if (error) throw new Error(error.message)
  }
}

// business_categories guarda TODAS las categorías del negocio. La primaria
// (is_primary = true) también se denormaliza en businesses.category_id (ver
// createBusiness/updateBusiness). Delete-all-then-insert, igual que upsertHours.
async function upsertBusinessCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  primaryId: string,
  secondaryIds: string[],
) {
  await supabase.from('business_categories').delete().eq('business_id', businessId)
  const rows = [
    { business_id: businessId, category_id: primaryId, is_primary: true },
    ...secondaryIds
      .filter((id) => id !== primaryId)
      .map((id) => ({ business_id: businessId, category_id: id, is_primary: false })),
  ]
  const { error } = await supabase.from('business_categories').insert(rows)
  if (error) throw new Error(error.message)
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

function firstIssue(err: import('zod').ZodError): string {
  return err.issues[0]?.message ?? 'Datos inválidos.'
}

function parseGallery(formData: FormData) {
  const raw = formData.get('gallery')
  if (typeof raw !== 'string' || !raw.trim()) return gallerySchema.safeParse([])
  let json: unknown = null
  try {
    json = JSON.parse(raw)
  } catch {
    // json queda null -> el schema falla con "Fotos inválidas."
  }
  return gallerySchema.safeParse(json)
}

type ResolvedPhoto = { url: string; caption: string | null }

/**
 * Sube los archivos nuevos de la galería y devuelve la lista final ya en orden.
 * `uploadedPaths` son los paths recién subidos, para poder limpiarlos si algo
 * falla después (mismo criterio que ya se usaba con la foto única).
 */
async function uploadGallery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gallery: GalleryValues,
  formData: FormData,
): Promise<{ photos: ResolvedPhoto[]; uploadedPaths: string[]; error: string | null }> {
  const photos: ResolvedPhoto[] = []
  const uploadedPaths: string[] = []

  for (const entry of gallery) {
    if (entry.url !== undefined) {
      photos.push({ url: entry.url, caption: entry.caption })
      continue
    }
    const file = formData.get(`photo_new_${entry.newIndex}`)
    const parsedFile = photoFileSchema.safeParse(file)
    if (!parsedFile.success) {
      return { photos, uploadedPaths, error: firstIssue(parsedFile.error) }
    }
    const path = `${crypto.randomUUID()}.${extFromMime(parsedFile.data.type)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsedFile.data, { contentType: parsedFile.data.type, upsert: false })
    if (uploadError) {
      return { photos, uploadedPaths, error: `Error subiendo foto: ${uploadError.message}` }
    }
    uploadedPaths.push(path)
    photos.push({
      url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
      caption: entry.caption,
    })
  }

  return { photos, uploadedPaths, error: null }
}

async function removePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  urlsOrPaths: string[],
) {
  const paths = urlsOrPaths
    .map((u) => (u.startsWith('http') ? pathFromPublicUrl(u) : u))
    .filter((p): p is string => p !== null)
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
}

// Delete-all-then-insert, igual que hours/services. order_index = posición en
// el array; la primera foto es la portada y se denormaliza en photo_url.
async function upsertPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  photos: ResolvedPhoto[],
) {
  await supabase.from('business_photos').delete().eq('business_id', businessId)
  const rows = photos.map((p, i) => ({
    business_id: businessId,
    url: p.url,
    caption: p.caption,
    order_index: i,
  }))
  if (rows.length > 0) {
    const { error } = await supabase.from('business_photos').insert(rows)
    if (error) throw new Error(error.message)
  }
}

/** Todas las fotos del negocio en storage — hay que leerlas antes de borrarlo
 *  (business_photos cae por cascade y se perderían los paths a limpiar). */
async function photoUrlsOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessIds: string[],
): Promise<string[]> {
  const { data } = await supabase
    .from('business_photos')
    .select('url')
    .in('business_id', businessIds)
  return (data ?? []).map((r) => r.url)
}

// uid del usuario actual, para sellar created_by/updated_by.
async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createBusiness(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const parsed = parseBusinessForm(formData)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { primary_category_id, secondary_category_ids, slug, ...data } = parsed.data
  const hours = parseHours(formData)
  const services = parseServices(formData)
  if (!services.success) return { error: firstIssue(services.error) }
  const gallery = parseGallery(formData)
  if (!gallery.success) return { error: firstIssue(gallery.error) }

  const supabase = await createClient()

  const {
    photos,
    uploadedPaths,
    error: uploadError,
  } = await uploadGallery(supabase, gallery.data, formData)
  if (uploadError) {
    await removePaths(supabase, uploadedPaths)
    return { error: uploadError }
  }

  const actorId = await currentUserId(supabase)
  const { data: inserted, error } = await supabase
    .from('businesses')
    .insert({
      ...data,
      // slug vacío → se omite para que el trigger de la DB lo autogenere del nombre.
      ...(slug ? { slug } : {}),
      category_id: primary_category_id,
      // La portada es la primera foto de la galería (ver business_photos).
      photo_url: photos[0]?.url ?? null,
      data_source: 'admin',
      created_by: actorId,
      updated_by: actorId,
    })
    .select('id')
    .single()

  if (error) {
    await removePaths(supabase, uploadedPaths)
    return { error: error.message }
  }

  try {
    await upsertBusinessCategories(
      supabase,
      inserted.id,
      primary_category_id,
      secondary_category_ids,
    )
    await upsertHours(supabase, inserted.id, hours)
    await upsertServices(supabase, inserted.id, services.data)
    await upsertPhotos(supabase, inserted.id, photos)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error guardando datos del negocio.' }
  }

  revalidatePath('/businesses')
  redirect('/businesses')
}

export async function updateBusiness(
  id: string,
  returnTo: string | undefined,
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const parsed = parseBusinessForm(formData)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { primary_category_id, secondary_category_ids, slug, ...data } = parsed.data
  // Se valida antes de subir nada: si servicios o galería traen error se corta
  // aquí y no quedan archivos huérfanos en el bucket.
  const services = parseServices(formData)
  if (!services.success) return { error: firstIssue(services.error) }
  const gallery = parseGallery(formData)
  if (!gallery.success) return { error: firstIssue(gallery.error) }

  const supabase = await createClient()

  // Las fotos que ya tenía: las que no sobrevivan en la galería nueva se
  // borran del storage al final.
  const previousUrls = await photoUrlsOf(supabase, [id])

  const {
    photos,
    uploadedPaths,
    error: uploadError,
  } = await uploadGallery(supabase, gallery.data, formData)
  if (uploadError) {
    await removePaths(supabase, uploadedPaths)
    return { error: uploadError }
  }

  const hours = parseHours(formData)

  const actorId = await currentUserId(supabase)
  const { error } = await supabase
    .from('businesses')
    .update({
      ...data,
      // slug vacío → se omite para NO tocar el slug existente (que ya circula
      // en links compartidos). Sólo se actualiza si el admin escribió uno.
      ...(slug ? { slug } : {}),
      category_id: primary_category_id,
      // La portada es la primera foto de la galería (ver business_photos).
      photo_url: photos[0]?.url ?? null,
      data_source: 'admin',
      updated_by: actorId,
    })
    .eq('id', id)

  if (error) {
    await removePaths(supabase, uploadedPaths)
    return { error: error.message }
  }

  try {
    await upsertBusinessCategories(supabase, id, primary_category_id, secondary_category_ids)
    await upsertHours(supabase, id, hours)
    await upsertServices(supabase, id, services.data)
    await upsertPhotos(supabase, id, photos)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error guardando datos del negocio.' }
  }

  // Recién ahora que la galería quedó guardada: limpiar del storage las fotos
  // que el admin quitó.
  const keptUrls = new Set(photos.map((p) => p.url))
  await removePaths(
    supabase,
    previousUrls.filter((u) => !keptUrls.has(u)),
  )

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
  redirect(returnTo || '/businesses')
}

export async function deleteBusiness(id: string) {
  // Sólo admin borra. El RLS de delete es is_admin(), pero sin este guard un
  // reviewer afectaría 0 filas sin error y aun así se borraría la foto del storage.
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') throw new Error('No autorizado.')

  const supabase = await createClient()

  // Se leen antes del delete: business_photos cae por cascade y se perderían
  // los paths que hay que limpiar del storage.
  const urls = await photoUrlsOf(supabase, [id])

  const { error } = await supabase.from('businesses').delete().eq('id', id)
  if (error) throw new Error(error.message)

  await removePaths(supabase, urls)

  revalidatePath('/businesses')
}

export async function toggleBusinessActive(id: string, nextActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({ is_active: nextActive, updated_by: await currentUserId(supabase) })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
}

export async function toggleBusinessFeatured(id: string, nextFeatured: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({ is_featured: nextFeatured, updated_by: await currentUserId(supabase) })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
}

export async function toggleBusinessDelivery(id: string, nextHasDelivery: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({ has_delivery: nextHasDelivery, updated_by: await currentUserId(supabase) })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
}

export type BulkCategoryResult = { error: string | null; updated: number }

// Cambia la categoría PRIMARIA de varios negocios a la vez. La primaria vieja se
// reemplaza (se elimina); las secundarias distintas a la nueva se conservan. El
// caller decide qué ids manda: la UI ya separó compatibles/incompatibles por tipo.
export async function bulkSetPrimaryCategory(
  businessIds: string[],
  categoryId: string,
): Promise<BulkCategoryResult> {
  const parsed = bulkCategorySchema.safeParse({ businessIds, categoryId })
  if (!parsed.success) return { error: firstIssue(parsed.error), updated: 0 }
  const { businessIds: ids, categoryId: newId } = parsed.data

  const supabase = await createClient()
  const actorId = await currentUserId(supabase)

  // business_categories NO tiene policy UPDATE en RLS (sólo insert/delete scopeadas
  // por municipio del negocio padre). Por eso, igual que upsertBusinessCategories,
  // esto va con delete+insert — nunca UPDATE ni upsert-onConflict.

  // 1. Denormalización en businesses.category_id (el badge de la card/lista).
  const { error: bizError } = await supabase
    .from('businesses')
    .update({ category_id: newId, updated_by: actorId })
    .in('id', ids)
  if (bizError) return { error: bizError.message, updated: 0 }

  // 2. Quitar la primaria anterior de cada negocio y cualquier fila previa de la
  //    nueva categoría (evita duplicado y dos primarias). Las demás secundarias
  //    se conservan.
  const { error: delError } = await supabase
    .from('business_categories')
    .delete()
    .in('business_id', ids)
    .or(`is_primary.eq.true,category_id.eq.${newId}`)
  if (delError) return { error: delError.message, updated: 0 }

  // 3. Insertar la nueva categoría como primaria de cada negocio.
  const { error: insError } = await supabase
    .from('business_categories')
    .insert(ids.map((business_id) => ({ business_id, category_id: newId, is_primary: true })))
  if (insError) return { error: insError.message, updated: 0 }

  revalidatePath('/businesses')
  return { error: null, updated: ids.length }
}

export type BulkResult = { error: string | null; updated: number }

export async function bulkSetActive(ids: string[], active: boolean): Promise<BulkResult> {
  const parsed = bulkIdsSchema.safeParse(ids)
  if (!parsed.success) return { error: firstIssue(parsed.error), updated: 0 }

  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({ is_active: active, updated_by: await currentUserId(supabase) })
    .in('id', parsed.data)
  if (error) return { error: error.message, updated: 0 }

  revalidatePath('/businesses')
  return { error: null, updated: parsed.data.length }
}

export async function bulkSetFeatured(ids: string[], featured: boolean): Promise<BulkResult> {
  const parsed = bulkIdsSchema.safeParse(ids)
  if (!parsed.success) return { error: firstIssue(parsed.error), updated: 0 }

  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({ is_featured: featured, updated_by: await currentUserId(supabase) })
    .in('id', parsed.data)
  if (error) return { error: error.message, updated: 0 }

  revalidatePath('/businesses')
  return { error: null, updated: parsed.data.length }
}

export async function bulkDeleteBusinesses(ids: string[]): Promise<BulkResult> {
  // Mismo guard que deleteBusiness: sin él un reviewer afectaría 0 filas por RLS
  // pero igual borraría las fotos del storage.
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') return { error: 'No autorizado.', updated: 0 }

  const parsed = bulkIdsSchema.safeParse(ids)
  if (!parsed.success) return { error: firstIssue(parsed.error), updated: 0 }

  const supabase = await createClient()

  // Se leen antes del delete: business_photos cae por cascade (ver deleteBusiness).
  const urls = await photoUrlsOf(supabase, parsed.data)

  const { error } = await supabase.from('businesses').delete().in('id', parsed.data)
  if (error) return { error: error.message, updated: 0 }

  await removePaths(supabase, urls)

  revalidatePath('/businesses')
  return { error: null, updated: parsed.data.length }
}

export async function toggleBusinessVerified(id: string, nextVerified: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({
      is_verified: nextVerified,
      verified_at: nextVerified ? new Date().toISOString() : null,
      updated_by: await currentUserId(supabase),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
}
