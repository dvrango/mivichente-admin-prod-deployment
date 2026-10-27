'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { setMissingReportStatusSchema } from './schema'

export type MissingReportActionState = { error: string | null }

/**
 * Marca un aviso como atendido o descartado, o lo regresa a pendiente.
 *
 * RLS es la protección real (`is_staff()` en la policy de update, y el grant
 * por columna solo deja tocar `status` y `reviewed_at`). El chequeo de rol de
 * aquí evita depender 100% de ella: una server action se puede invocar
 * directo, sin pasar por el layout que rebota a `pending` y `owner`.
 */
export async function setMissingReportStatus(
  _prev: MissingReportActionState,
  formData: FormData,
): Promise<MissingReportActionState> {
  const profile = await getCurrentProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'reviewer')) {
    return { error: 'No tienes permiso para revisar avisos.' }
  }

  const parsed = setMissingReportStatusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { error: 'Datos inválidos.' }
  const { id, status } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('missing_business_reports')
    .update({
      status,
      reviewed_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  // Un update que RLS filtra no truena: afecta 0 filas. Sin esto, la UI diría
  // que se guardó.
  if (!data || data.length === 0) return { error: 'Aviso no encontrado.' }

  revalidatePath('/missing-businesses')
  return { error: null }
}
