import { createClient } from '@/lib/supabase/client'
import { BUSINESS_PHOTOS_BUCKET, pathFromPublicUrl } from '@/lib/storage'
import { compressImage } from './compress-image'

/**
 * Comprime y sube una foto directo desde el browser al bucket de negocios.
 *
 * Va directo a storage, no por un server action, por dos razones: la policy
 * `"business-photos admin write"` es `for all to authenticated` (o sea el
 * cliente del navegador ya tiene permiso), y los server actions traen un límite
 * de body de 1 MB por default que una foto de celular (3–6 MB) rebasa sin
 * problema — ese límite es justo lo que rompía el form de escritorio.
 *
 * La fila en la DB (`business_photos` en modo campo, `business_photos` /
 * `business_services` en el form) la escribe siempre un server action con la
 * URL que devuelve esta función.
 *
 * @param prefix carpeta dentro del bucket. El modo campo usa el id del negocio;
 *   el form de escritorio sube a la raíz porque al crear todavía no hay id.
 */
export async function uploadBusinessPhoto(
  file: File,
  prefix?: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()

  let compressed
  try {
    compressed = await compressImage(file)
  } catch {
    return { url: null, error: 'No se pudo procesar la foto. Intenta con otra.' }
  }

  const name = `${crypto.randomUUID()}.${compressed.extension}`
  const path = prefix ? `${prefix}/${name}` : name

  const { error } = await supabase.storage
    .from(BUSINESS_PHOTOS_BUCKET)
    .upload(path, compressed.blob, { contentType: compressed.type, upsert: false })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUSINESS_PHOTOS_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/**
 * Borra fotos ya subidas cuando la operación se aborta ANTES de mandarlas al
 * server (ej. una de varias fotos falló al subir). Si el guardado ya llegó al
 * server action, la limpieza la hace él con `uploadedPaths`.
 *
 * Best-effort: un huérfano en el bucket no debe romperle el guardado al
 * usuario, así que los errores se ignoran.
 */
export async function removeUploadedPhotos(urls: string[]): Promise<void> {
  const paths = urls.map((u) => pathFromPublicUrl(u)).filter((p): p is string => p !== null)
  if (paths.length === 0) return
  try {
    await createClient().storage.from(BUSINESS_PHOTOS_BUCKET).remove(paths)
  } catch {
    // Huérfano en el bucket: molesto, no bloqueante.
  }
}
