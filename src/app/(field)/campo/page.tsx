import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { FieldSearch } from '@/features/field/components/field-search'
import { getRecentFieldBusinesses } from '@/features/field/queries'

export const metadata = { title: 'Captura en campo' }

export default async function CampoPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const recent = await getRecentFieldBusinesses(profile.id)

  return (
    <FieldSearch municipio={profile.municipio} isAdmin={profile.role === 'admin'} recent={recent} />
  )
}
