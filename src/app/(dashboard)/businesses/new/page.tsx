import { PageHeader } from '@/components/shared/page-header'
import { createBusiness } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { getActiveCategoryOptions } from '@/features/businesses/queries'

export default async function NewBusinessPage() {
  const categories = await getActiveCategoryOptions()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo negocio"
        breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: 'Nuevo' }]}
      />
      <BusinessForm action={createBusiness} submitLabel="Crear" categories={categories} />
    </div>
  )
}
