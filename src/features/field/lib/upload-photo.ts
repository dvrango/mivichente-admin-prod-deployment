import { uploadBusinessPhoto } from '@/lib/images/upload-business-photo'

/**
 * Comprime y sube una foto de campo, agrupada bajo la carpeta del negocio.
 *
 * La compresión y la subida viven en `@/lib/images/upload-business-photo`,
 * compartidas con el form de escritorio. La fila en `business_photos` sí la
 * inserta un server action (`addFieldPhoto`), para que la denormalización de
 * `photo_url` quede del lado del servidor.
 */
export function uploadFieldPhoto(
  businessId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  return uploadBusinessPhoto(file, businessId)
}
