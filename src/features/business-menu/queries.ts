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
/** Un tamaño o presentación del platillo, con su propio precio. */
export type MenuVariant = {
  id: string
  name: string
  price: number
  order_index: number
}

/**
 * Una opción elegible dentro de un grupo: "Capuchino", "Deslactosada",
 * "Shot de espresso".
 *
 * `price_delta` es lo que SUMA al precio de la línea; nunca lo fija ni lo baja.
 * 0 es el caso normal — de los grupos que necesita K-fféss, casi todos son
 * elecciones sin costo.
 */
export type MenuOption = {
  id: string
  name: string
  price_delta: number
  order_index: number
}

/**
 * Un grupo de opciones del platillo: "Sabor", "Leche", "Extra".
 *
 * `min_select` / `max_select` son los nombres de la DB y acá se conservan tal
 * cual. La traducción a lo que lee quien captura ("¿tiene que elegir?",
 * "¿cuántas puede elegir?") vive en el formulario, que es donde se lee.
 *
 * Obligatorio es `min_select >= 1`: no hay columna `is_required` a propósito,
 * porque tener las dos permitiría capturar un grupo "obligatorio" con
 * `min_select = 0`, que se contradice a sí mismo. `max_select` null = sin tope.
 */
export type MenuOptionGroup = {
  id: string
  name: string
  min_select: number
  max_select: number | null
  order_index: number
  options: MenuOption[]
}

export type MenuItem = {
  id: string
  name: string
  /**
   * PostgREST puede serializar `numeric` como string ("75.00") — el menú de
   * mesa lo documenta en landing/src/lib/menu-de-mesa.ts. Acá se normaliza a
   * number en la query para que la UI no tenga que adivinar.
   *
   * Cuando el ítem tiene `variants`, esto NO es "el precio" sino el MENOR de
   * ellas — el "desde". Lo mantiene así el server en cada guardado; la UI no lo
   * calcula ni lo manda.
   */
  price: number | null
  description: string | null
  image_url: string | null
  section: string | null
  order_index: number
  is_published: boolean
  show_in_profile: boolean
  updated_at: string
  variants: MenuVariant[]
  /**
   * Lo que el cliente ELIGE del platillo además del tamaño. Vacío es el caso de
   * casi todo el catálogo: sólo los menús de comida con sabores y extras los
   * usan.
   */
  option_groups: MenuOptionGroup[]
}

// Las variantes y los grupos de opciones vienen embebidos en la misma query:
// son pocas filas por platillo en el peor caso real (K-fféss, el menú con más
// opciones, tiene 3 grupos en su platillo más cargado) y traerlos aparte sería
// un round-trip por ítem.
//
// Va en UNA sola línea a propósito: el cliente de Supabase infiere el tipo del
// resultado desde el literal, y si se parte con `+` pierde la forma del embed y
// todo el select degrada a `GenericStringError`. Vale igual para el embed
// anidado de dos niveles (grupo -> opciones) que se agregó después.
// prettier-ignore
export const MENU_ITEM_COLUMNS =
  'id, name, price, description, image_url, section, order_index, is_published, show_in_profile, updated_at, business_service_variants(id, name, price, order_index), business_service_option_groups(id, name, min_select, max_select, order_index, business_service_options(id, name, price_delta, order_index))'

type MenuVariantRow = Omit<MenuVariant, 'price'> & { price: number | string }

type MenuOptionRow = Omit<MenuOption, 'price_delta'> & { price_delta: number | string }

type MenuOptionGroupRow = Omit<MenuOptionGroup, 'options'> & {
  business_service_options: MenuOptionRow[] | null
}

type MenuItemRow = Omit<MenuItem, 'price' | 'variants' | 'option_groups'> & {
  price: number | string | null
  business_service_variants: MenuVariantRow[] | null
  business_service_option_groups: MenuOptionGroupRow[] | null
}

const byOrderIndex = (a: { order_index: number }, b: { order_index: number }) =>
  a.order_index - b.order_index

export function toMenuItem(row: MenuItemRow): MenuItem {
  const { business_service_variants, business_service_option_groups, ...rest } = row
  return {
    ...rest,
    price: row.price === null ? null : Number(row.price),
    // El embed de PostgREST no garantiza orden; se ordena acá para que el array
    // sea el orden de despliegue, igual que en la galería de fotos.
    variants: (business_service_variants ?? [])
      .map((v) => ({ ...v, price: Number(v.price) }))
      .sort(byOrderIndex),
    // Mismo tratamiento un nivel más abajo: el orden de las opciones dentro del
    // grupo también es de despliegue, no incidental.
    option_groups: (business_service_option_groups ?? [])
      .map(({ business_service_options, ...group }) => ({
        ...group,
        options: (business_service_options ?? [])
          .map((o) => ({ ...o, price_delta: Number(o.price_delta) }))
          .sort(byOrderIndex),
      }))
      .sort(byOrderIndex),
  }
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
