import { PageHeader } from '@/components/shared/page-header'
import { SearchPreview } from '@/features/search-preview/components/search-preview'

export default function SearchPreviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Simulador de búsqueda" />
      <SearchPreview />
    </div>
  )
}
