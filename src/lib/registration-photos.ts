import { BUSINESS_PHOTOS_BUCKET } from './storage'
import type { createClient } from './supabase/server'

/**
 * Bucket de staging de las fotos que llegan por el formulario público de la
 * landing. Es PRIVADO a propósito: `business-photos` es público, así que una
 * foto que cayera ahí sería visible en la app en el momento en que se sube, y
 * lo que entra por un formulario abierto puede ser de un tercero, un logo ajeno
 * o contenido inapropiado. Aquí no se ve hasta que un admin aprueba.
 *
 * Escribe la landing con la service role key; lee y borra el admin como
 * `authenticated` (ver la migración 20260825120000).
 */
export const REGISTRATION_PHOTOS_BUCKET = 'registration-photos'

/** Cuánto vive la URL con la que el admin ve la foto antes de aprobar. */
const SIGNED_URL_TTL_SEGUNDOS = 60 * 60

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * URLs firmadas para ver fotos del bucket privado, por path. Los paths que
 * fallen simplemente no aparecen en el resultado: una foto que no se puede
 * previsualizar no debe tumbar la lista de solicitudes.
 */
export async function signedUrlsForRegistrationPhotos(
  supabase: SupabaseServerClient,
  paths: string[],
): Promise<Record<string, string>> {
  const unicos = [...new Set(paths.filter(Boolean))]
  if (unicos.length === 0) return {}

  const { data, error } = await supabase.storage
    .from(REGISTRATION_PHOTOS_BUCKET)
    .createSignedUrls(unicos, SIGNED_URL_TTL_SEGUNDOS)

  if (error || !data) return {}

  const porPath: Record<string, string> = {}
  for (const item of data) {
    if (item.path && item.signedUrl) porPath[item.path] = item.signedUrl
  }
  return porPath
}

/**
 * Copia las fotos del staging al bucket público, en orden, y devuelve sus URLs.
 * La primera es la portada del negocio.
 *
 * Se COPIAN, no se mueven: los originales se borran sólo después de que el
 * negocio quedó guardado (`discardRegistrationPhotos`). Al revés —borrar
 * primero— un fallo al guardar dejaría al dueño sin fotos y sin forma de
 * recuperarlas.
 *
 * ⚠️ Devolver la URL no basta para que la foto sobreviva: `businesses.photo_url`
 * es una denormalización de la primera fila de `business_photos`, y cada
 * guardado del negocio desde el admin borra la galería y la reinserta
 * recalculando `photo_url`. Quien llame tiene que crear la fila en
 * `business_photos`, no sólo escribir la URL.
 */
export async function copyRegistrationPhotosToBusinessBucket(
  supabase: SupabaseServerClient,
  paths: string[],
): Promise<{ urls: string[]; error: string | null }> {
  const urls: string[] = []
  for (const path of paths) {
    const { url, error } = await copyRegistrationPhotoToBusinessBucket(supabase, path)
    // Se corta al primer fallo en vez de seguir: el orden importa (la primera
    // es la portada) y una copia parcial silenciosa es peor que un error claro.
    if (!url) return { urls, error }
    urls.push(url)
  }
  return { urls, error: null }
}

async function copyRegistrationPhotoToBusinessBucket(
  supabase: SupabaseServerClient,
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  // Nombre nuevo en el destino: el del staging es un UUID sin relación con el
  // negocio, y reusarlo tal cual mezclaría los dos espacios de nombres.
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : 'jpg'
  const destino = `${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(REGISTRATION_PHOTOS_BUCKET)
    .copy(path, destino, { destinationBucket: BUSINESS_PHOTOS_BUCKET })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUSINESS_PHOTOS_BUCKET).getPublicUrl(destino)
  return { url: data.publicUrl, error: null }
}

/**
 * Saca la foto del staging. Se llama al aprobar (ya se copió) y al rechazar (no
 * se va a usar). Best-effort: un huérfano en el bucket es molesto, no
 * bloqueante, y no debe convertir un rechazo exitoso en un error en pantalla.
 */
export async function discardRegistrationPhotos(
  supabase: SupabaseServerClient,
  paths: string[] | null | undefined,
): Promise<void> {
  if (!paths || paths.length === 0) return
  try {
    await supabase.storage.from(REGISTRATION_PHOTOS_BUCKET).remove(paths)
  } catch {
    // Huérfanos en staging: se limpian después, no rompen el flujo.
  }
}
