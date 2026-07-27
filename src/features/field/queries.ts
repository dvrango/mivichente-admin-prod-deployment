import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { CompletenessInput } from '@/features/businesses/completeness'
import { fetchBusinessIdsWithHours } from '@/features/businesses/hours'

/** Cuántos negocios recientes se ofrecen para volver de un toque. */
export const RECENT_FIELD_LIMIT = 8

export type RecentFieldBusiness = CompletenessInput & {
  id: string
  name: string
  is_active: boolean
  updated_at: string
}

/**
 * Los últimos negocios que tocó este usuario, para regresar a uno sin volver a
 * buscarlo. Se filtra por `updated_by` y no por `created_by` a propósito: en la
 * campaña casi todo lo que se captura ya existía (scraping) y sólo se completa.
 */
export async function getRecentFieldBusinesses(userId: string): Promise<RecentFieldBusiness[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('businesses')
    .select(
      'id, name, is_active, updated_at, phone, description, photo_url, address, maps_url, category_id, offerings, schedule, facebook_url, instagram_url',
    )
    .eq('updated_by', userId)
    .order('updated_at', { ascending: false })
    .limit(RECENT_FIELD_LIMIT)
  if (error) throw error

  const rows = data ?? []
  const withHours = await fetchBusinessIdsWithHours(
    supabase,
    rows.map((b) => b.id),
  )
  return rows.map((b) => ({ ...b, hasHours: withHours.has(b.id) }))
}

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
