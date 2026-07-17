import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { formatDateLong } from '@/lib/date'
import { getCurrentProfile } from '@/features/auth/queries'
import { updateBusiness, type BusinessFormState } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { ToggleActiveButton } from '@/features/businesses/components/toggle-active-button'
import { ToggleDeliveryButton } from '@/features/businesses/components/toggle-delivery-button'
import { ToggleFeaturedButton } from '@/features/businesses/components/toggle-featured-button'
import { ToggleVerifiedButton } from '@/features/businesses/components/toggle-verified-button'
import {
  getActiveCategoryOptions,
  getBusinessById,
  getBusinessCategoryIds,
  getBusinessHours,
  getBusinessPhotos,
  getBusinessServices,
} from '@/features/businesses/queries'

export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  const { returnTo } = await searchParams
  const [business, categories, hours, services, photos, categoryIds, profile] = await Promise.all([
    getBusinessById(id),
    getActiveCategoryOptions(),
    getBusinessHours(id),
    getBusinessServices(id),
    getBusinessPhotos(id),
    getBusinessCategoryIds(id),
    getCurrentProfile(),
  ])

  if (!business) notFound()

  const lockedMunicipio =
    profile?.role === 'reviewer' ? (profile.municipio ?? undefined) : undefined

  // Reviewer ahora ve negocios de cualquier municipio (RLS ampliado), pero
  // solo puede escribir en el suyo — el UPDATE de RLS sigue exigiendo match.
  // Sin este gate el formulario se ve editable y falla en el submit.
  const readOnly = !!lockedMunicipio && business.municipio !== lockedMunicipio

  // Sólo se acepta un returnTo relativo dentro de /businesses (evita open redirect).
  const safeReturnTo = returnTo?.startsWith('/businesses') ? returnTo : undefined

  const action = updateBusiness.bind(null, id, safeReturnTo) as (
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
          readOnly ? (
            <Badge variant="outline">Solo lectura · {business.municipio}</Badge>
          ) : (
            <div className="flex gap-2">
              <ToggleVerifiedButton id={business.id} isVerified={business.is_verified} />
              <ToggleFeaturedButton id={business.id} isFeatured={business.is_featured} />
              <ToggleDeliveryButton id={business.id} hasDelivery={business.has_delivery} />
              <ToggleActiveButton id={business.id} isActive={business.is_active} />
            </div>
          )
        }
      />
      <div className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          Creado por{' '}
          <span className="text-foreground font-medium">
            {business.created_by_profile?.email ?? 'desconocido'}
          </span>{' '}
          el {formatDateLong(business.created_at)}
        </p>
        <p>
          Última edición por{' '}
          <span className="text-foreground font-medium">
            {business.updated_by_profile?.email ?? 'desconocido'}
          </span>{' '}
          el {formatDateLong(business.updated_at)}
        </p>
      </div>

      <BusinessForm
        action={action}
        submitLabel="Guardar"
        categories={categories}
        lockedMunicipio={lockedMunicipio}
        readOnly={readOnly}
        defaults={{
          name: business.name,
          slug: business.slug,
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
          services_label: business.services_label,
          facebook_url: business.facebook_url,
          instagram_url: business.instagram_url,
          offerings: business.offerings,
        }}
        defaultHours={hours}
        defaultServices={services}
        defaultPhotos={photos}
      />
    </div>
  )
}
