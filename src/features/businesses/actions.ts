'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/features/auth/queries'
import { bulkCategorySchema, bulkIdsSchema, parseBusinessForm } from './schema'
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
  const { photo, primary_category_id, secondary_category_ids, ...data } = parsed.data
  const hours = parseHours(formData)

  const supabase = await createClient()

  let photo_url: string | null = null
  if (photo) {
    const path = `${crypto.randomUUID()}.${extFromMime(photo.type)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false })
    if (uploadError) return { error: `Error subiendo foto: ${uploadError.message}` }
    photo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  const actorId = await currentUserId(supabase)
  const { data: inserted, error } = await supabase
    .from('businesses')
    .insert({
      ...data,
      category_id: primary_category_id,
      photo_url,
      data_source: 'admin',
      created_by: actorId,
      updated_by: actorId,
    })
    .select('id')
    .single()

  if (error) {
    if (photo_url) {
      const p = pathFromPublicUrl(photo_url)
      if (p) await supabase.storage.from(BUCKET).remove([p])
    }
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
  const { photo, primary_category_id, secondary_category_ids, ...data } = parsed.data

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('businesses')
    .select('photo_url')
    .eq('id', id)
    .single()
  if (fetchError) return { error: fetchError.message }

  let photo_url: string | null = existing.photo_url
  let oldPathToDelete: string | null = null
  if (photo) {
    const path = `${crypto.randomUUID()}.${extFromMime(photo.type)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false })
    if (uploadError) return { error: `Error subiendo foto: ${uploadError.message}` }
    photo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    if (existing.photo_url) oldPathToDelete = pathFromPublicUrl(existing.photo_url)
  }

  const hours = parseHours(formData)

  const actorId = await currentUserId(supabase)
  const { error } = await supabase
    .from('businesses')
    .update({
      ...data,
      category_id: primary_category_id,
      photo_url,
      data_source: 'admin',
      updated_by: actorId,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  if (oldPathToDelete) {
    await supabase.storage.from(BUCKET).remove([oldPathToDelete])
  }

  try {
    await upsertBusinessCategories(supabase, id, primary_category_id, secondary_category_ids)
    await upsertHours(supabase, id, hours)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error guardando datos del negocio.' }
  }

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

  const { data: existing, error: fetchError } = await supabase
    .from('businesses')
    .select('photo_url')
    .eq('id', id)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const { error } = await supabase.from('businesses').delete().eq('id', id)
  if (error) throw new Error(error.message)

  if (existing.photo_url) {
    const path = pathFromPublicUrl(existing.photo_url)
    if (path) await supabase.storage.from(BUCKET).remove([path])
  }

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

  const { data: rows, error: fetchError } = await supabase
    .from('businesses')
    .select('photo_url')
    .in('id', parsed.data)
  if (fetchError) return { error: fetchError.message, updated: 0 }

  const { error } = await supabase.from('businesses').delete().in('id', parsed.data)
  if (error) return { error: error.message, updated: 0 }

  const paths = (rows ?? [])
    .map((r) => (r.photo_url ? pathFromPublicUrl(r.photo_url) : null))
    .filter((p): p is string => p !== null)
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)

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
