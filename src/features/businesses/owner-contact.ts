import 'server-only'
import type { createClient } from '@/lib/supabase/server'

// Contacto interno del dueño. Vive en `business_owner_contacts` y no en
// `businesses` porque `businesses` la lee anon con `select('*')` y las RPC
// `setof businesses`: cualquier columna ahí es pública (tarea yekdqmi27).
// RLS de la tabla: lee y escribe el admin, o el reviewer del municipio del
// negocio. Anon no tiene grant.
//
// Va en un módulo aparte, no en un archivo `'use server'`: todo lo que exporta
// un archivo así se vuelve un endpoint invocable desde el navegador.

export type OwnerContact = {
  owner?: string | null
  owner_phone?: string | null
  owner_contact_note?: string | null
}

const OWNER_KEYS = ['owner', 'owner_phone', 'owner_contact_note'] as const

/** Separa los campos del dueño del resto de un patch de negocio. */
export function splitOwnerContact<T extends OwnerContact>(
  data: T,
): { owner: OwnerContact; rest: Omit<T, (typeof OWNER_KEYS)[number]> } {
  const { owner, owner_phone, owner_contact_note, ...rest } = data
  const ownerPatch: OwnerContact = {}
  if (owner !== undefined) ownerPatch.owner = owner
  if (owner_phone !== undefined) ownerPatch.owner_phone = owner_phone
  if (owner_contact_note !== undefined) ownerPatch.owner_contact_note = owner_contact_note
  return { owner: ownerPatch, rest }
}

/**
 * Guarda los campos del dueño que vengan en `contact` (los `undefined` no se
 * tocan). Si todo lo que llega es vacío, solo limpia una fila existente: no
 * crea filas vacías por cada guardado de un negocio sin dueño.
 *
 * Devuelve el mensaje de error de Supabase, o null. Un reviewer de otro
 * municipio recibe error de RLS en vez de un update silencioso de 0 filas.
 */
export async function saveOwnerContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  contact: OwnerContact,
): Promise<string | null> {
  const keys = OWNER_KEYS.filter((k) => contact[k] !== undefined)
  if (keys.length === 0) return null

  const hasValue = keys.some((k) => {
    const v = contact[k]
    return typeof v === 'string' && v.trim() !== ''
  })

  if (!hasValue) {
    const { error } = await supabase
      .from('business_owner_contacts')
      .update(contact)
      .eq('business_id', businessId)
    return error?.message ?? null
  }

  const { error } = await supabase
    .from('business_owner_contacts')
    .upsert({ business_id: businessId, ...contact }, { onConflict: 'business_id' })
  return error?.message ?? null
}
