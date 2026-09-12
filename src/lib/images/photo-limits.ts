/**
 * Qué acepta el bucket `business-photos`, en un solo lugar.
 *
 * Es el espejo en TypeScript de los límites que la migración
 * `20260911120000_lock_down_authenticated_access` le puso al bucket. Si allá
 * cambia la lista o el tamaño, acá también — si no, el cliente deja pasar algo
 * que storage rechaza (o al revés, bloquea algo que sí cabía).
 *
 * Existe porque la subida ocurre EN EL BROWSER, directo a storage
 * (`upload-business-photo.ts`), antes de que corra cualquier server action. El
 * Zod del form de escritorio valida en el server: nunca alcanza a proteger esa
 * subida, y las otras dos entradas (modo campo y editor de menú) ni siquiera
 * pasan por Zod.
 */

/** 5 MB. Mismo número que `file_size_limit` en el bucket. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024

/**
 * Formatos que se le ofrecen a quien elige un archivo. Son los tres que
 * cualquier navegador y la app mobile saben pintar.
 */
export const PHOTO_PICKER_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Formatos que el bucket tolera pero que no se ofrecen en el picker: la cámara
 * de iOS entrega HEIC, y cuando `createImageBitmap` no puede decodificarlo
 * `compressImage` sube el original sin convertir. Rechazarlos acá le rompería
 * la captura a cualquier iPhone.
 */
const PHOTO_FALLBACK_MIME = ['image/heic', 'image/heif'] as const

/** La lista completa del bucket. Derivada, no copiada: una sola fuente. */
export const PHOTO_BUCKET_MIME = [...PHOTO_PICKER_MIME, ...PHOTO_FALLBACK_MIME] as const

/** Valor del atributo `accept` de un `<input type="file">`. */
export const PHOTO_PICKER_ACCEPT = PHOTO_PICKER_MIME.join(',')

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')
}

/** 'image/tiff' -> 'TIFF'. Para nombrar el formato sin escupir el mime crudo. */
function formatName(mime: string): string {
  const sub = mime.split('/')[1] ?? mime
  return sub.split('+')[0].toUpperCase()
}

/**
 * Por qué el bucket NO aceptaría este archivo, en español y accionable, o
 * `null` si sí lo acepta.
 *
 * Se le pasan el tipo y el tamaño de lo que REALMENTE se va a subir (o sea la
 * salida de `compressImage`, no el archivo que eligió la persona): así el
 * criterio es exactamente el del bucket y es imposible rechazar una foto que
 * hoy sube bien.
 */
export function photoUploadRejection(type: string, size: number): string | null {
  if (!type) {
    return 'No se reconoce el formato de esta foto. Vuelve a tomarla o elige otra.'
  }
  if (!(PHOTO_BUCKET_MIME as readonly string[]).includes(type)) {
    return `No se pueden subir archivos ${formatName(type)}. Usa una foto JPG, PNG o WEBP.`
  }
  if (size > PHOTO_MAX_BYTES) {
    return `La foto pesa ${megabytes(size)} MB y el máximo es ${megabytes(PHOTO_MAX_BYTES)} MB. Elige una más ligera o recórtala.`
  }
  return null
}
