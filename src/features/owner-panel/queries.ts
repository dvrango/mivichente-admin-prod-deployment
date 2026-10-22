import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { OwnerBusinessSnapshot, OwnerBusinessSummary } from './types'

// El dueño no tiene grants sobre ninguna tabla: todo lo lee por estas dos
// funciones, que deciden en la DB qué negocio es suyo. Si la cuenta no es
// `owner` o el negocio no está ligado a ella, regresan vacío o null.

export async function getOwnerBusinesses(): Promise<OwnerBusinessSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('owner_businesses')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getOwnerBusinessSnapshot(
  businessId: string,
): Promise<OwnerBusinessSnapshot | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('owner_business_snapshot', {
    p_business_id: businessId,
  })
  if (error) throw new Error(error.message)
  return (data as OwnerBusinessSnapshot | null) ?? null
}
