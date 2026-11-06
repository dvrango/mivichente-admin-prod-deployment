'use server'

import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import { redeemStampCardSchema, stampCardTokenSchema } from './schema'
import { stampCardErrorOf, type StampCardResult, type StampCardState } from './stamp-card'

// Las únicas escrituras del panel del dueño: dar un sello y canjear el premio
// de la tarjeta de sellos (mikitasks w26gamoh8). El resto del panel sigue siendo
// de solo lectura (decisión del 2026-10-22); la excepción está en «Demo de
// Rewards con sellos por visita».
//
// La protección real vive en la DB: el dueño no tiene grants sobre ninguna
// tabla, y `owner_add_stamp` / `owner_redeem_stamp_card` revisan
// `is_owner_of()` del negocio de la tarjeta, uno por día y una sola vez por
// canje. El guard de rol de aquí solo evita llamar a la DB sin sesión de dueño.
//
// El token es un secreto al portador: con él se sella. Viaja solo en el cuerpo
// de estas llamadas, nunca en la URL, y no se registra en ningún log ni mensaje
// de error. No hay `revalidatePath`: el snapshot del panel no cambia con un
// sello, y la pantalla pinta el estado que regresa la función.

type OwnerStateRow = Database['public']['Functions']['owner_get_stamp_card']['Returns'][number]

function toState(row: OwnerStateRow): StampCardState {
  return {
    cardId: row.card_id ?? null,
    businessId: row.business_id,
    businessName: row.business_name,
    programActive: row.program_active,
    reward: row.reward ?? null,
    stampsRequired: row.stamps_required,
    stamps: row.stamps,
    isFull: row.is_full,
    stampedToday: row.stamped_today,
    lastRedeemedAt: row.last_redeemed_at ?? null,
  }
}

async function requireOwner(): Promise<void> {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'owner') redirect('/businesses')
}

function fromRpc(data: OwnerStateRow[] | null, error: { message: string } | null): StampCardResult {
  if (error) return { ok: false, error: stampCardErrorOf(error.message) }
  const row = data?.[0]
  if (!row) return { ok: false, error: 'unknown' }
  return { ok: true, card: toState(row) }
}

/** D2 → D3: lee la tarjeta sin cambiar nada. */
export async function readStampCard(token: string): Promise<StampCardResult> {
  await requireOwner()
  const parsed = stampCardTokenSchema.safeParse({ token })
  if (!parsed.success) return { ok: false, error: 'not_a_card' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('owner_get_stamp_card', {
    p_token: parsed.data.token,
  })
  return fromRpc(data, error)
}

/** D3 → D4: da el sello del día. Un segundo intento el mismo día responde `already_stamped_today`. */
export async function addStamp(token: string): Promise<StampCardResult> {
  await requireOwner()
  const parsed = stampCardTokenSchema.safeParse({ token })
  if (!parsed.success) return { ok: false, error: 'not_a_card' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('owner_add_stamp', {
    p_token: parsed.data.token,
  })
  return fromRpc(data, error)
}

/** D6 → D7: canjea la vuelta llena. Un segundo intento responde `already_redeemed`. */
export async function redeemStampCard(cardId: string): Promise<StampCardResult> {
  await requireOwner()
  const parsed = redeemStampCardSchema.safeParse({ cardId })
  if (!parsed.success) return { ok: false, error: 'not_a_card' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('owner_redeem_stamp_card', {
    p_card_id: parsed.data.cardId,
  })
  return fromRpc(data, error)
}
