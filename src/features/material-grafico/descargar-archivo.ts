import { slugify } from '@/lib/slug'

const EXTENSION_POR_TIPO: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
}

/** Extensión del archivo descargado. Manda el `Content-Type` real del blob:
 *  la extensión de la URL puede mentir (`compress-image.ts` documenta un HEIC
 *  guardado como `<uuid>.jpg`). La URL sólo es el respaldo. */
export function extensionDe(tipo: string, url: string): string {
  const porTipo = EXTENSION_POR_TIPO[tipo.split(';')[0].trim().toLowerCase()]
  if (porTipo) return porTipo
  const porUrl = /\.([a-z0-9]{3,4})(?:$|[?#])/i.exec(url)?.[1]?.toLowerCase()
  return porUrl === 'jpeg' ? 'jpg' : (porUrl ?? 'jpg')
}

/** `{slug}-{etiqueta}` legible al buscarlo en Descargas o al adjuntarlo:
 *  `kffess-portada`, `kffess-capuchino-frio`. */
export function nombreBase(slug: string, etiqueta: string): string {
  return [slug, slugify(etiqueta)].filter(Boolean).join('-')
}

/** Descarga un blob ya generado en el navegador (las piezas de canvas). */
export function descargarBlob(blob: Blob, nombre: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = nombre
  a.click()
  // Revocar en el mismo tick puede cancelar la descarga en Safari.
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/**
 * Descarga una imagen de otro origen con nombre propio.
 *
 * Un `<a download>` con la URL de Storage no sirve: el navegador ignora
 * `download` en URLs de otro origen y abre la imagen en vez de bajarla. Por eso
 * se baja con `fetch` y se descarga el blob. Si el host no manda CORS, `fetch`
 * truena; quien llama muestra un link para abrirla y guardarla a mano.
 */
export async function descargarImagen(url: string, base: string): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return false
    const blob = await res.blob()
    descargarBlob(blob, `${base}.${extensionDe(blob.type, url)}`)
    return true
  } catch {
    return false
  }
}
