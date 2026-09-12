// Compresión en el cliente antes de subir. Nació en el modo campo, donde es la
// mayor ganancia de fricción: una foto de celular pesa 3–6 MB y sale de aquí en
// 200–400 KB, o sea ~15× menos tiempo de subida sobre datos móviles. Vive acá
// (y ya no bajo `features/field/`) porque el form de escritorio la usa igual.
//
// OJO: NO garantiza que lo que sale de aquí quepa en el bucket. Los tres
// `return original` de abajo devuelven el archivo tal como llegó —tipo y tamaño
// incluidos—, así que quien sube tiene que validar la SALIDA contra los límites
// del bucket. Eso lo hace `upload-business-photo.ts` con `photoUploadRejection`.

/** Lado largo al que se reescala antes de subir. */
export const PHOTO_TARGET_LONG_EDGE = 1600
//
// Sin dependencia externa: `createImageBitmap` + canvas hacen todo el trabajo.

const WEBP_QUALITY = 0.8
const JPEG_QUALITY = 0.82

export type CompressedImage = {
  blob: Blob
  /** 'image/webp' o 'image/jpeg' — siempre uno que acepta el bucket. */
  type: string
  extension: string
}

// La extensión sale del mime REAL, no de un default. Antes esto mandaba a `jpg`
// todo lo que no fuera webp, así que un HEIC que atraviesa la compresión sin
// convertir (los `return original` de abajo) terminaba guardado como
// `<uuid>.jpg` con mimetype `image/heic`: un archivo que miente sobre su
// contenido y que no pinta ni la app, ni `next/image`, ni un navegador que no
// sea de Apple — y sin error en ningún lado.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

function extensionFor(mime: string): string {
  return EXTENSION_BY_MIME[mime] ?? 'jpg'
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) {
    try {
      return await canvas.convertToBlob({ type, quality })
    } catch {
      return null
    }
  }
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Reescala a `PHOTO_TARGET_LONG_EDGE` en el lado largo y recomprime.
 *
 * Si el resultado no pesa menos que el original, devuelve el original — pasa
 * con imágenes ya optimizadas, donde recomprimir sólo degrada.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const original: CompressedImage = {
    blob: file,
    type: file.type,
    extension: extensionFor(file.type),
  }

  // `imageOrientation: 'from-image'` NO es opcional: sin él, las fotos verticales
  // tomadas con el celular llegan acostadas (el EXIF se pierde al rasterizar).
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return original
  }

  try {
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const scale = longEdge > PHOTO_TARGET_LONG_EDGE ? PHOTO_TARGET_LONG_EDGE / longEdge : 1
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height })

    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, width, height)

    let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY)
    // Safari viejo ignora webp y devuelve PNG: se detecta por el type real.
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
    }
    if (!blob) return original
    if (blob.size >= file.size) return original

    return { blob, type: blob.type, extension: extensionFor(blob.type) }
  } finally {
    bitmap.close()
  }
}
