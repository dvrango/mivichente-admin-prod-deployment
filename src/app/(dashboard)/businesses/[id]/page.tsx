import { notFound } from 'next/navigation'
import { formatDateLong } from '@/lib/date'
import { getCurrentProfile } from '@/features/auth/queries'
import { updateBusiness, type BusinessFormState } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { BusinessStatusCard } from '@/features/businesses/components/business-status-card'
import { businessFormSections } from '@/features/businesses/form-sections'
import {
  getActiveCategoryOptions,
  getBusinessById,
  getBusinessCategoryIds,
  getBusinessHours,
  getBusinessPhotos,
} from '@/features/businesses/queries'

// Tab «Datos» de `/businesses/[id]`. El encabezado y los tabs vienen del
// layout; aquí van el form de la ficha y la tarjeta de estado.
export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  const { returnTo } = await searchParams
  const [business, categories, hours, photos, categoryIds, profile] = await Promise.all([
    getBusinessById(id),
    getActiveCategoryOptions(),
    getBusinessHours(id),
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

  // Sólo se acepta un returnTo relativo dentro de /businesses o /campo (evita
  // open redirect). /campo es el viaje de vuelta: se entra al editor desde la
  // pantalla de captura y al guardar se regresa al mismo negocio en campo.
  const safeReturnTo =
    returnTo?.startsWith('/businesses') || returnTo?.startsWith('/campo') ? returnTo : undefined

  const action = updateBusiness.bind(null, id, safeReturnTo) as (
    prev: BusinessFormState,
    formData: FormData,
  ) => Promise<BusinessFormState>

  const sections = businessFormSections({ hasDelivery: business.has_delivery })

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <aside className="space-y-4 lg:sticky lg:top-0 lg:order-last">
        <BusinessStatusCard
          id={business.id}
          isActive={business.is_active}
          isVerified={business.is_verified}
          isFeatured={business.is_featured}
          hasDelivery={business.has_delivery}
          acceptsOrders={business.accepts_orders}
          canManageOrders={profile?.role === 'admin'}
          readOnly={readOnly}
        />

        {/* Índice del form: en celular el form ya se recorre con scroll y el
            índice solo empujaría el contenido hacia abajo. */}
        <nav aria-label="Secciones del formulario" className="hidden lg:block">
          <ul className="space-y-0.5 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-2 py-1"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Solo en escritorio: en celular el aside va arriba del form y esta
            línea lo empujaba sin aportar a la captura. */}
        <p className="text-muted-foreground hidden px-2 text-xs leading-relaxed lg:block">
          Editado por {business.updated_by_profile?.email ?? 'desconocido'} el{' '}
          {formatDateLong(business.updated_at)}. Creado por{' '}
          {business.created_by_profile?.email ?? 'desconocido'} el{' '}
          {formatDateLong(business.created_at)}.
          {business.is_verified && business.verified_at && (
            <> Verificado el {formatDateLong(business.verified_at)}.</>
          )}
        </p>
      </aside>

      <BusinessForm
        action={action}
        submitLabel="Guardar cambios"
        categories={categories}
        lockedMunicipio={lockedMunicipio}
        readOnly={readOnly}
        defaults={{
          delivery_fee: business.delivery_fee,
          has_delivery: business.has_delivery,
          name: business.name,
          slug: business.slug,
          primary_category_id: categoryIds.primaryId ?? business.category_id,
          secondary_category_ids: categoryIds.secondaryIds,
          phone: business.phone,
          phone_is_whatsapp: business.phone_is_whatsapp,
          whatsapp_phone: business.whatsapp_phone,
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
          owner: business.owner_contact?.owner ?? null,
          owner_phone: business.owner_contact?.owner_phone ?? null,
          owner_contact_note: business.owner_contact?.owner_contact_note ?? null,
          latitude: business.latitude,
          longitude: business.longitude,
        }}
        defaultHours={hours}
        defaultPhotos={photos}
        businessId={id}
      />
    </div>
  )
}
