// Helpers del bucket de fotos. Viven fuera de `features/*/actions.ts` porque
// un archivo 'use server' sólo puede exportar funciones async, y estos son
// helpers síncronos que necesitan tanto el form de escritorio como el modo campo.

export const BUSINESS_PHOTOS_BUCKET = 'business-photos'

/**
 * Path dentro del bucket a partir de una URL pública. Devuelve null si la URL
 * no apunta a este bucket. Corta después del marcador, así que las subcarpetas
 * (ej. `{businessId}/{uuid}.webp`) sobreviven el round-trip.
 */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUSINESS_PHOTOS_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}
