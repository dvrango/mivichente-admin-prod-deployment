'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/features/auth/queries'
import { TARJETAS_POR_HOJA } from './geometria'
import { TOKEN_FISICA, crearHojaSchema } from './schema'

export type ResultadoHoja = { ok: true; tokens: string[] } | { ok: false; error: string }

/**
 * Crea en la DB las tarjetas físicas de una hoja y regresa sus tokens para que
 * el navegador arme el PDF. Es la ÚNICA escritura de esta pantalla, y cada
 * llamada deja 20 físicas en producción que no se borran: por eso la vista
 * previa no pasa por aquí y el botón pide confirmación.
 *
 * Solo admin. La protección real es `is_admin()` dentro de
 * `admin_create_physical_cards` (y que anon no tiene execute); este guard evita
 * que una llamada manual al Server Action llegue a la DB sin sesión de admin.
 * Los tokens solo viajan en esta respuesta: no se guardan ni se registran.
 */
export async function crearHojaTarjetas(businessId: string): Promise<ResultadoHoja> {
  await requireAdmin()

  const parsed = crearHojaSchema.safeParse({ businessId })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_create_physical_cards', {
    p_business_id: parsed.data.businessId,
    p_count: TARJETAS_POR_HOJA,
  })

  if (error) {
    if (error.code === '42501') {
      return { ok: false, error: 'Solo un administrador puede generar tarjetas.' }
    }
    if (error.message.includes('business_not_found')) {
      return { ok: false, error: 'No se encontró el negocio.' }
    }
    return { ok: false, error: error.message }
  }

  const tokens = (data ?? []).map((fila) => fila.token)
  // Una hoja mal formada no se imprime: mejor fallar aquí que en caja.
  if (
    tokens.length !== TARJETAS_POR_HOJA ||
    new Set(tokens).size !== tokens.length ||
    !tokens.every((t) => TOKEN_FISICA.test(t))
  ) {
    return {
      ok: false,
      error: `La base de datos regresó ${tokens.length} tarjetas que no sirven para una hoja. Genera otra.`,
    }
  }

  return { ok: true, tokens }
}
