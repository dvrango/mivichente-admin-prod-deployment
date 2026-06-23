'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type RegistrationActionState = { error: string | null }

export async function approveRegistration(
  _prev: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { error: 'ID inválido.' }

  const supabase = await createClient()

  const { data: reg, error: fetchErr } = await supabase
    .from('business_registrations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !reg) return { error: 'Solicitud no encontrada.' }

  const { error: bizErr } = await supabase.from('businesses').insert({
    name: reg.business_name,
    phone: reg.phone,
    municipio: reg.municipio,
    description: reg.description,
    is_active: false,
    data_source: 'self_registered',
    phone_is_whatsapp: false,
  })

  if (bizErr) return { error: `Error al crear negocio: ${bizErr.message}` }

  const { error: updateErr } = await supabase
    .from('business_registrations')
    .update({ status: 'approved' })
    .eq('id', id)

  if (updateErr) return { error: `Error al actualizar solicitud: ${updateErr.message}` }

  revalidatePath('/registrations')
  revalidatePath('/businesses')
  return { error: null }
}

export async function rejectRegistration(
  _prev: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const id = formData.get('id')
  const notes = formData.get('notes')
  if (typeof id !== 'string') return { error: 'ID inválido.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('business_registrations')
    .update({
      status: 'rejected',
      ...(typeof notes === 'string' && notes.trim() ? { notes: notes.trim() } : {}),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/registrations')
  return { error: null }
}
