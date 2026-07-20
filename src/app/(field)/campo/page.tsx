import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { FieldSearch } from '@/features/field/components/field-search'

export const metadata = { title: 'Captura en campo' }

export default async function CampoPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return <FieldSearch municipio={profile.municipio} isAdmin={profile.role === 'admin'} />
}
