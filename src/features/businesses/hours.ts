import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * De una lista de negocios, cuáles tienen filas en `business_hours`.
 *
 * Va en una segunda query en vez de embebido en el select de cada pantalla
 * porque los dos buscadores (campo y simulador) no leen `businesses`
 * directamente: llaman la RPC `search_businesses`, que devuelve `setof
 * businesses` y no trae relaciones. Una query extra por búsqueda, con la lista
 * de ids ya acotada por la página de resultados.
 *
 * No lleva `server-only`: lo usan tanto componentes cliente (buscadores) como
 * queries de servidor, y sólo lee lo que el RLS ya permite leer.
 */
export async function fetchBusinessIdsWithHours(
  supabase: SupabaseClient<Database>,
  businessIds: string[],
): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('business_hours')
    .select('business_id')
    .in('business_id', businessIds)

  // Sin horarios legibles el semáforo se degrada a "le falta horario", que es el
  // mismo estado que tenía antes de este fix: se prefiere eso a romper la lista.
  if (error) return new Set()

  return new Set((data ?? []).map((row) => row.business_id))
}
