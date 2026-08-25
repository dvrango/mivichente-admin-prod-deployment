import 'server-only'
import { signedUrlsForRegistrationPhotos } from '@/lib/registration-photos'
import { createClient } from '@/lib/supabase/server'
import { REGISTRATIONS_PAGE_SIZE, type RegistrationFilters } from './schema'
import type { BusinessRegistration } from './types'

/**
 * Rellena `photo_preview_urls` con URLs firmadas por cada solicitud que traiga
 * fotos. El bucket es privado, así que sin esto quien revisa aprobaría a ciegas
 * — y la foto sin ver es justo el riesgo que el staging existe para cubrir.
 *
 * Una sola llamada para toda la página: firmar de a una sería N round-trips.
 * Se conserva el orden de `photo_paths`, que es el de la galería: la primera
 * foto es la portada.
 */
async function conUrlsDeFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: BusinessRegistration[],
): Promise<BusinessRegistration[]> {
  const paths = rows.flatMap((r) => r.photo_paths ?? [])
  if (paths.length === 0) return rows

  const urls = await signedUrlsForRegistrationPhotos(supabase, paths)
  return rows.map((r) => ({
    ...r,
    // Las que no se pudieron firmar se caen del arreglo: una preview rota no
    // debe correr el orden de las demás ni tumbar la lista.
    photo_preview_urls: (r.photo_paths ?? []).map((p) => urls[p]).filter((u): u is string => !!u),
  }))
}

export type RegistrationsPage = {
  rows: BusinessRegistration[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function getRegistrations(filters: RegistrationFilters): Promise<RegistrationsPage> {
  const supabase = await createClient()
  const pageSize = REGISTRATIONS_PAGE_SIZE
  const from = (filters.page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('business_registrations')
    .select('*', { count: 'exact' })
    .eq('status', filters.status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  const total = count ?? 0
  return {
    rows: await conUrlsDeFoto(supabase, (data ?? []) as BusinessRegistration[]),
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getRegistrationById(id: string): Promise<BusinessRegistration | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_registrations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  const [row] = await conUrlsDeFoto(supabase, [data as BusinessRegistration])
  return row
}
