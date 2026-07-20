import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type FieldPhoto = {
  id: string
  url: string
  caption: string | null
  /** Qué es la foto: 'fachada' | 'menu' | … (ver PHOTO_KINDS). */
  kind: string
  order_index: number
}

/**
 * Fotos con su `id`, que el modo campo necesita para borrar y para cambiar la
 * portada. `getBusinessPhotos` de businesses/queries devuelve sólo url+caption
 * porque el form de escritorio reemplaza la galería completa y no las direcciona
 * individualmente.
 */
export async function getFieldPhotos(businessId: string): Promise<FieldPhoto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_photos')
    .select('id, url, caption, kind, order_index')
    .eq('business_id', businessId)
    .order('order_index')
  if (error) throw error
  return data ?? []
}
