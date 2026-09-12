import { createClient } from '@/lib/supabase/client'
import { BUSINESS_PHOTOS_BUCKET, pathFromPublicUrl } from '@/lib/storage'
import { compressImage } from './compress-image'
import { photoUploadRejection } from './photo-limits'

/**
 * Traduce el error que devuelve storage a algo que se pueda leer. Los dos
 * primeros casos deberían ser inalcanzables (arriba ya se validó contra los
 * mismos límites), pero si el bucket cambia y el código no, el mensaje crudo
 * de Supabase viene en inglés y nombra headers — no le dice a nadie qué hacer.
 *
 * Cualquier otro error se deja pasar tal cual: un fallo de red y uno de
 * permisos se ven idénticos si se los aplana a "no se pudo subir", y el modo
 * campo enseña este texto justo para poder distinguirlos.
 */
function storageErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('maximum allowed size') || lower.includes('payload too large')) {
    return 'La foto pesa más de lo que acepta el servidor. Elige una más ligera.'
  }
  if (lower.includes('mime type') || lower.includes('not supported')) {
    return 'El servidor no acepta ese formato de archivo. Usa una foto JPG, PNG o WEBP.'
  }
  return message
}

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

  // Se valida `compressed`, NO `file`: lo que llega al bucket es la salida de
  // compressImage, y esa salida es el archivo original sin convertir en tres
  // casos (createImageBitmap falla, no hay contexto 2D, o recomprimir no ahorra
  // nada). O sea que un archivo que el bucket no acepta puede atravesar la
  // compresión intacto. Validar acá es validar exactamente los bytes que va a
  // recibir storage: ni se rechaza una foto que hoy sube bien, ni se deja pasar
  // una que el bucket va a tumbar con un error en inglés.
  //
  // Este es el único punto de validación de las tres entradas —form de
  // escritorio, modo campo y editor de menú— porque las tres suben por aquí.
  const rejection = photoUploadRejection(compressed.type, compressed.blob.size)
  if (rejection) return { url: null, error: rejection }

  const name = `${crypto.randomUUID()}.${compressed.extension}`
  const path = prefix ? `${prefix}/${name}` : name

  const { error } = await supabase.storage
    .from(BUSINESS_PHOTOS_BUCKET)
    .upload(path, compressed.blob, { contentType: compressed.type, upsert: false })

  if (error) return { url: null, error: storageErrorMessage(error.message) }

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
