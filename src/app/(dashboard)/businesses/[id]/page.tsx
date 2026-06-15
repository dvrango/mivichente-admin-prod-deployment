import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { updateBusiness, type BusinessFormState } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { ToggleActiveButton } from '@/features/businesses/components/toggle-active-button'
import { getActiveCategoryOptions, getBusinessById } from '@/features/businesses/queries'

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, categories] = await Promise.all([
    getBusinessById(id),
    getActiveCategoryOptions(),
  ])

  if (!business) notFound()

  const action = updateBusiness.bind(null, id) as (
    prev: BusinessFormState,
    formData: FormData,
  ) => Promise<BusinessFormState>

  return (
    <div className="space-y-6">
      <PageHeader
        title={business.name}
        breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: business.name }]}
        actions={<ToggleActiveButton id={business.id} isActive={business.is_active} />}
      />
      <BusinessForm
        action={action}
        submitLabel="Guardar"
        categories={categories}
        defaults={{
          name: business.name,
          category_id: business.category_id,
          phone: business.phone,
          phone_is_whatsapp: business.phone_is_whatsapp,
          address: business.address,
          schedule: business.schedule,
          maps_url: business.maps_url,
          photo_url: business.photo_url,
          aliases: business.aliases,
        }}
      />
    </div>
  )
}
