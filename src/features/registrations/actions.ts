'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  copyRegistrationPhotosToBusinessBucket,
  discardRegistrationPhotos,
} from '@/lib/registration-photos'
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
      'id, business_id, business_name, phone, contact_name, contact_phone, municipio, description, offerings, giro, status, photo_paths',
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

    // Los archivos no caben en un query param, pero sus URLs sí. Se copian al
    // bucket público ANTES de redirigir y viajan como URLs ya subidas: el form
    // las trata igual que las fotos de una edición normal (`gallery` con `url`),
    // así que `createBusiness` les crea sus filas en `business_photos` sin
    // código nuevo. Separadas por `|`, mismo formato que `offerings`.
    //
    // Con el tope de 3 fotos la URL se queda holgada; si algún día sube ese
    // tope, esto hay que cambiarlo por leer las fotos de la solicitud usando el
    // `fromRegistration` que ya viaja aquí.
    //
    // Si el admin abandona el form sin guardar, esas copias quedan huérfanas en
    // el bucket — mismo comportamiento que ya tiene el form al subir fotos y
    // cancelar (tarea jdrqc28fv). Lo que NO queda huérfano es el staging: se
    // limpia aquí, ya con la copia hecha.
    if (reg.photo_paths?.length) {
      const { urls, error } = await copyRegistrationPhotosToBusinessBucket(
        supabase,
        reg.photo_paths,
      )
      if (urls.length > 0) params.set('photo_urls', urls.join('|'))
      if (error) {
        // Las que no se copiaron se quedan en staging para no perderlas: la
        // solicitud sigue aprobándose y el admin puede subirlas a mano.
        console.error('no se pudieron copiar todas las fotos del registro', reg.id, error)
      } else {
        await discardRegistrationPhotos(supabase, reg.photo_paths)
      }
    }

    redirect(`/businesses/new?${params.toString()}`)
  }

  const { data: business, error: bizFetchErr } = await supabase
    .from('businesses')
    .select('id, phone, description, offerings, owner, owner_phone, owner_contact_note, photo_url')
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

  // La foto sólo entra si el negocio no tiene ninguna: mismo criterio que el
  // resto del patch —se rellenan huecos, no se pisa lo que ya revisó un humano.
  //
  // Se miran las DOS cosas, y no basta con una: la galería es la fuente de
  // verdad, pero hay negocios con `photo_url` y cero filas en `business_photos`
  // (284 contra 275 en prod, herencia de antes de que existiera la galería).
  // Mirando sólo la galería, a esos se les pisaría la portada que ya tenían.
  let copiaFallida = false
  if (reg.photo_paths?.length) {
    const { count } = await supabase
      .from('business_photos')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)

    if ((count ?? 0) === 0 && !business.photo_url?.trim()) {
      const { urls, error } = await copyRegistrationPhotosToBusinessBucket(
        supabase,
        reg.photo_paths,
      )
      if (error) copiaFallida = true

      if (urls.length > 0) {
        // ⚠️ Las filas en `business_photos` NO son opcionales, y van ANTES del
        // update del negocio. Cada guardado desde el admin borra la galería, la
        // reinserta y recalcula `photo_url = photos[0]?.url ?? null`: una foto
        // que sólo viviera en `photo_url` desaparecería en silencio en la
        // siguiente edición. Escribir primero la galería evita dejar el negocio
        // justo en ese estado si el insert falla — ahí simplemente no hay foto.
        // La galería estaba vacía, así que el order_index es la posición y la
        // primera foto queda de portada.
        const { error: photoErr } = await supabase.from('business_photos').insert(
          urls.map((url, i) => ({
            business_id: business.id,
            url,
            order_index: i,
          })),
        )

        if (photoErr) {
          copiaFallida = true
          console.error('no se pudieron guardar las fotos del registro', reg.id, photoErr.message)
        } else {
          patch.photo_url = urls[0]
        }
      } else if (error) {
        // Se dejan en staging para no perderlas; la aprobación sigue su curso.
        console.error('no se pudieron copiar las fotos del registro', reg.id, error)
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ ...patch, updated_by: user?.id ?? null })
    .eq('id', business.id)

  if (bizErr) return { error: `Error al completar el negocio: ${bizErr.message}` }

  // La solicitud queda cerrada, así que el staging se limpia aunque las fotos
  // no se hayan usado (el negocio ya tenía galería): nadie va a volver por
  // ellas y el bucket no puede crecer para siempre. Las únicas que se conservan
  // son las que fallaron al copiarse — esas sí se perderían sin haberse
  // guardado en ningún lado.
  if (!copiaFallida) await discardRegistrationPhotos(supabase, reg.photo_paths)

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

  // Se lee antes del update para saber si hay archivo que limpiar.
  const { data: reg } = await supabase
    .from('business_registrations')
    .select('photo_paths')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('business_registrations')
    .update({
      status: 'rejected',
      ...(typeof notes === 'string' && notes.trim() ? { notes: notes.trim() } : {}),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Una solicitud rechazada no va a usar sus fotos nunca, y pueden ser justo la
  // razón del rechazo (contenido de un tercero o inapropiado). Fuera del bucket.
  await discardRegistrationPhotos(supabase, reg?.photo_paths)

  revalidatePath('/registrations')
  return { error: null }
}
