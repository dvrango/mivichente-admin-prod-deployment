import { PHOTO_TARGET_LONG_EDGE } from '../constants'

// Compresión en el cliente antes de subir. Es la mayor ganancia de fricción de
// todo el modo campo: una foto de celular pesa 3–6 MB y sale de aquí en 200–400
// KB, o sea ~15× menos tiempo de subida sobre datos móviles. De paso, nunca se
// choca con el límite de 5 MB que valida Zod.
//
// Sin dependencia externa: `createImageBitmap` + canvas hacen todo el trabajo.

const WEBP_QUALITY = 0.8
const JPEG_QUALITY = 0.82

export type CompressedImage = {
  blob: Blob
  /** 'image/webp' o 'image/jpeg' — siempre uno que acepta el bucket. */
  type: string
  extension: 'webp' | 'jpg'
}

function extensionFor(mime: string): 'webp' | 'jpg' {
  return mime === 'image/webp' ? 'webp' : 'jpg'
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
