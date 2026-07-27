'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeMxPhone } from '@/lib/validation/phone'

export type RegistrationActionState = { error: string | null }

/**
 * Aprobar una solicitud de auto-registro.
 *
 * Dos caminos, según `business_registrations.business_id`:
 *
 *  - CON business_id: la solicitud es de un negocio que YA está en el catálogo
 *    (el dueño lo encontró y pidió completarlo). Se COMPLETA el existente, nunca
 *    se inserta — antes esto creaba un duplicado garantizado.
 *  - SIN business_id: no se inserta a ciegas. Se manda al form de escritorio
 *    PRECARGADO con lo que mandó el dueño, para que el admin elija categoría y
 *    revise antes de crear. `createBusiness` cierra la solicitud al guardar.
 *
 * Al completar sólo se rellenan los huecos: lo que ya tiene el negocio (revisado
 * por un humano) le gana a lo que tecleó el dueño en un form público.
 */
export async function approveRegistration(
  _prev: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { error: 'ID inválido.' }

  const supabase = await createClient()

  const { data: reg, error: fetchErr } = await supabase
    .from('business_registrations')
    .select(
      'id, business_id, business_name, phone, contact_name, contact_phone, municipio, description, offerings, giro, status',
    )
    .eq('id', id)
    .single()

  if (fetchErr || !reg) return { error: 'Solicitud no encontrada.' }
  if (reg.status === 'approved') return { error: 'Esta solicitud ya fue aprobada.' }

  if (!reg.business_id) {
    // Sin negocio ligado: el admin decide categoría y revisa antes de crear.
    // Todo lo que mandó el dueño viaja en la URL para no perderlo (incluido el
    // giro, que acota de qué lado del catálogo buscar la categoría).
    const params = new URLSearchParams({ fromRegistration: reg.id })
    params.set('name', reg.business_name)
    params.set('phone', reg.phone)
    params.set('municipio', reg.municipio)
    params.set('contact_name', reg.contact_name)
    if (reg.contact_phone) params.set('contact_phone', reg.contact_phone)
    if (reg.description) params.set('description', reg.description)
    if (reg.offerings.length > 0) params.set('offerings', reg.offerings.join('|'))
    if (reg.giro) params.set('giro', reg.giro)
    redirect(`/businesses/new?${params.toString()}`)
  }

  const { data: business, error: bizFetchErr } = await supabase
    .from('businesses')
    .select('id, phone, description, offerings, owner, owner_phone, owner_contact_note')
    .eq('id', reg.business_id)
    .single()

  if (bizFetchErr || !business) {
    return { error: 'El negocio ligado a la solicitud ya no existe.' }
  }

  // Unión de ofertas sin duplicados (case-insensitive): lo que el dueño declara
  // vender es justo lo que lo hace aparecer en las búsquedas.
  const mergedOfferings = [...business.offerings]
  for (const offering of reg.offerings) {
    const label = offering.trim()
    if (!label) continue
    if (!mergedOfferings.some((o) => o.toLowerCase() === label.toLowerCase())) {
      mergedOfferings.push(label)
    }
  }

  const patch: Record<string, unknown> = { offerings: mergedOfferings }
  if (!business.description?.trim() && reg.description?.trim()) {
    patch.description = reg.description.trim()
  }
  if (!business.owner?.trim()) patch.owner = reg.contact_name
  if (!business.owner_phone?.trim() && reg.contact_phone) {
    patch.owner_phone = normalizeMxPhone(reg.contact_phone)
  }
  // El teléfono del contacto no pisa el público: si el negocio no tenía ninguno
  // (imposible hoy, phone es NOT NULL) igual quedaría el de la solicitud.
  if (!business.phone?.trim()) patch.phone = normalizeMxPhone(reg.phone)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ ...patch, updated_by: user?.id ?? null })
    .eq('id', business.id)

  if (bizErr) return { error: `Error al completar el negocio: ${bizErr.message}` }

  const { error: updateErr } = await supabase
    .from('business_registrations')
    .update({ status: 'approved' })
    .eq('id', id)

  if (updateErr) return { error: `Error al actualizar solicitud: ${updateErr.message}` }

  revalidatePath('/registrations')
  revalidatePath('/businesses')
  revalidatePath(`/businesses/${business.id}`)
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
