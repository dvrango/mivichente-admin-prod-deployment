import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { formatDateLong } from '@/lib/date'
import { updateBusiness, type BusinessFormState } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { ToggleActiveButton } from '@/features/businesses/components/toggle-active-button'
import { ToggleFeaturedButton } from '@/features/businesses/components/toggle-featured-button'
import { ToggleVerifiedButton } from '@/features/businesses/components/toggle-verified-button'
import {
  getActiveCategoryOptions,
  getBusinessById,
  getBusinessCategoryIds,
  getBusinessHours,
} from '@/features/businesses/queries'

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, categories, hours, categoryIds] = await Promise.all([
    getBusinessById(id),
    getActiveCategoryOptions(),
    getBusinessHours(id),
    getBusinessCategoryIds(id),
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
        description={
          business.is_verified && business.verified_at ? (
            <span className="inline-flex items-center gap-2">
              <Badge className="bg-blue-500 text-white hover:bg-blue-600">Verificado</Badge>
              el {formatDateLong(business.verified_at)}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex gap-2">
            <ToggleVerifiedButton id={business.id} isVerified={business.is_verified} />
            <ToggleFeaturedButton id={business.id} isFeatured={business.is_featured} />
            <ToggleActiveButton id={business.id} isActive={business.is_active} />
          </div>
        }
      />
      <BusinessForm
        action={action}
        submitLabel="Guardar"
        categories={categories}
        defaults={{
          name: business.name,
          primary_category_id: categoryIds.primaryId ?? business.category_id,
          secondary_category_ids: categoryIds.secondaryIds,
          phone: business.phone,
          phone_is_whatsapp: business.phone_is_whatsapp,
          address: business.address,
          maps_url: business.maps_url,
          municipio: business.municipio,
          colonia: business.colonia,
          photo_url: business.photo_url,
          aliases: business.aliases,
          description: business.description,
          facebook_url: business.facebook_url,
          instagram_url: business.instagram_url,
          offerings: business.offerings,
        }}
        defaultHours={hours}
      />
    </div>
  )
}
