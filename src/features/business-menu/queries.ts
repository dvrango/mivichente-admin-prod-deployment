import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Un ítem del menú tal como lo necesita el editor: con su `id` y su
 * `order_index`.
 *
 * El form del negocio leía los mismos datos SIN el id (`getBusinessServices`,
 * borrada el 2026-09-02) porque reemplazaba el menú completo y no direccionaba
 * filas individuales. Editar ítem por ítem sí las direcciona, así que necesita
 * el id — fue el bloqueo de entrada de todo el editor nuevo.
 * Mismo motivo por el que existe `getFieldPhotos` al lado de `getBusinessPhotos`.
 */
export type MenuItem = {
  id: string
  name: string
  /**
   * PostgREST puede serializar `numeric` como string ("75.00") — el menú de
   * mesa lo documenta en landing/src/lib/menu-de-mesa.ts. Acá se normaliza a
   * number en la query para que la UI no tenga que adivinar.
   */
  price: number | null
  description: string | null
  image_url: string | null
  section: string | null
  order_index: number
  is_published: boolean
  show_in_profile: boolean
  updated_at: string
}

export const MENU_ITEM_COLUMNS =
  'id, name, price, description, image_url, section, order_index, is_published, show_in_profile, updated_at'

type MenuItemRow = Omit<MenuItem, 'price'> & { price: number | string | null }

export function toMenuItem(row: MenuItemRow): MenuItem {
  return { ...row, price: row.price === null ? null : Number(row.price) }
}

/**
 * Menú completo de un negocio para el editor.
 *
 * Mismo orden que hoy (`order_index`, desempate por `name`) para que el editor
 * pinte exactamente lo que ven el menú de mesa y el perfil. El desempate existe
 * porque `order_index` NO es único a propósito: reordenar intercambia el índice
 * de dos filas en vez de renumerar el catálogo.
 */
export async function getMenuItems(businessId: string): Promise<MenuItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_services')
    .select(MENU_ITEM_COLUMNS)
    .eq('business_id', businessId)
    .order('order_index')
    .order('name')
  if (error) throw error
  return (data ?? []).map(toMenuItem)
}

/**
 * Cuántos ítems tiene el menú, sin traerlos.
 *
 * Quien sólo quiere saber cuántos hay usaba `getBusinessServices(id).length`,
 * o sea 83 filas con descripciones y URLs para calcular un número. `head: true`
 * pide sólo el header de conteo. Lo usan la pantalla de material gráfico y el
 * resumen del menú dentro del form del negocio.
 */
export async function countMenuItems(businessId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('business_services')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
  if (error) throw error
  return count ?? 0
}
