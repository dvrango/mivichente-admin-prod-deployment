'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseBusinessForm } from './schema'

export type BusinessFormState = { error: string | null }

const BUCKET = 'business-photos'

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

export async function createBusiness(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const parsed = parseBusinessForm(formData)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { photo, ...data } = parsed.data

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

  const { error } = await supabase
    .from('businesses')
    .insert({ ...data, photo_url, data_source: 'admin' })

  if (error) {
    if (photo_url) {
      const p = pathFromPublicUrl(photo_url)
      if (p) await supabase.storage.from(BUCKET).remove([p])
    }
    return { error: error.message }
  }

  revalidatePath('/businesses')
  redirect('/businesses')
}

export async function updateBusiness(
  id: string,
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const parsed = parseBusinessForm(formData)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { photo, ...data } = parsed.data

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

  const { error } = await supabase
    .from('businesses')
    .update({ ...data, photo_url, data_source: 'admin' })
    .eq('id', id)

  if (error) return { error: error.message }

  if (oldPathToDelete) {
    await supabase.storage.from(BUCKET).remove([oldPathToDelete])
  }

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
  redirect('/businesses')
}

export async function toggleBusinessActive(id: string, nextActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('businesses').update({ is_active: nextActive }).eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
}

export async function toggleBusinessVerified(id: string, nextVerified: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({
      is_verified: nextVerified,
      verified_at: nextVerified ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/businesses')
  revalidatePath(`/businesses/${id}`)
}
