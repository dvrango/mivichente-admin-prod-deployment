import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export type Role = 'admin' | 'reviewer'

export type Profile = {
  id: string
  email: string | null
  role: Role
  municipio: string | null
}

// Cacheado por request (React cache) para no repetir la query en cada
// server component (layout + páginas la piden por separado).
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, municipio')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return {
    id: data.id,
    email: user.email ?? null,
    role: data.role as Role,
    municipio: data.municipio,
  }
})

// Guard para páginas/acciones sólo-admin. Redirige al reviewer a /businesses.
// El RLS es la protección real; esto evita render/acciones inútiles y fugas de UI.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/businesses')
  return profile
}
