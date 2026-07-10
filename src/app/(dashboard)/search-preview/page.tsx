import { PageHeader } from '@/components/shared/page-header'
import { SearchPreview } from '@/features/search-preview/components/search-preview'
import { getCurrentProfile } from '@/features/auth/queries'

export default async function SearchPreviewPage() {
  const profile = await getCurrentProfile()
  return (
    <div className="space-y-6">
      <PageHeader title="Simulador de búsqueda" />
      <SearchPreview defaultMunicipio={profile?.municipio ?? undefined} />
    </div>
  )
}
