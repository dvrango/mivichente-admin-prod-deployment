import { createClient } from '@/lib/supabase/client'
import { BUSINESS_PHOTOS_BUCKET } from '@/lib/storage'
import { compressImage } from './compress-image'

/**
 * Comprime y sube una foto directo desde el browser al bucket.
 *
 * Va directo a storage, no por un server action, por dos razones: la policy
 * `"business-photos admin write"` es `for all to authenticated` (o sea el
 * cliente del navegador ya tiene permiso), y los server actions traen un límite
 * de body de 1 MB por default que una foto rebasa sin problema.
 *
 * La fila en `business_photos` sí la inserta un server action (`addFieldPhoto`),
 * para que la denormalización de `photo_url` quede del lado del servidor.
 */
export async function uploadFieldPhoto(
  businessId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  const { blob, type, extension } = await compressImage(file)

  const path = `${businessId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from(BUSINESS_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: type, upsert: false })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUSINESS_PHOTOS_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
