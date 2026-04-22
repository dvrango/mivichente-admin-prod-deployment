'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type BusinessFormState = { error: string | null }

const BUCKET = 'business-photos'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

type Parsed =
  | {
      ok: true
      data: {
        name: string
        category_id: string
        phone: string
        address: string | null
        schedule: string | null
      }
      photo: File | null
    }
  | { ok: false; error: string }

function readForm(formData: FormData): Parsed {
  const name = String(formData.get('name') ?? '').trim()
  const category_id = String(formData.get('category_id') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim() || null
  const schedule = String(formData.get('schedule') ?? '').trim() || null
  const photoRaw = formData.get('photo')
  const photo = photoRaw instanceof File && photoRaw.size > 0 ? photoRaw : null

  if (!name) return { ok: false, error: 'El nombre es requerido.' }
  if (!category_id) return { ok: false, error: 'La categoría es requerida.' }
  if (!phone) return { ok: false, error: 'El teléfono es requerido.' }

  if (photo) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: 'La foto excede 5 MB.' }
    }
    if (!ALLOWED_MIME.includes(photo.type)) {
      return { ok: false, error: 'Formato inválido. Usa JPG, PNG o WEBP.' }
    }
  }

  return {
    ok: true,
    data: { name, category_id, phone, address, schedule },
    photo,
  }
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

export async function createBusiness(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const parsed = readForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()

  let photo_url: string | null = null
  if (parsed.photo) {
    const path = `${crypto.randomUUID()}.${extFromMime(parsed.photo.type)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.photo, { contentType: parsed.photo.type, upsert: false })
    if (uploadError) return { error: `Error subiendo foto: ${uploadError.message}` }
    photo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase.from('businesses').insert({ ...parsed.data, photo_url })

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
  const parsed = readForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('businesses')
    .select('photo_url')
    .eq('id', id)
    .single()
  if (fetchError) return { error: fetchError.message }

  let photo_url: string | null = existing.photo_url
  let oldPathToDelete: string | null = null
  if (parsed.photo) {
    const path = `${crypto.randomUUID()}.${extFromMime(parsed.photo.type)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.photo, { contentType: parsed.photo.type, upsert: false })
    if (uploadError) return { error: `Error subiendo foto: ${uploadError.message}` }
    photo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    if (existing.photo_url) oldPathToDelete = pathFromPublicUrl(existing.photo_url)
  }

  const { error } = await supabase
    .from('businesses')
    .update({ ...parsed.data, photo_url })
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
