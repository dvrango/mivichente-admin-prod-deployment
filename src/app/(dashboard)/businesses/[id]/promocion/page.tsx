import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { getCurrentProfile } from '@/features/auth/queries'
import { updateBusinessPromo, type PromoFormState } from '@/features/businesses/actions'
import { BusinessPromoForm } from '@/features/businesses/components/business-promo-form'
import { promoStatus } from '@/features/businesses/promo'
import { getBusinessById } from '@/features/businesses/queries'

// Página hija de /businesses/[id], hermana de /menu y /material. Va aparte del
// form del negocio para que capturar una promo no obligue a guardar la ficha
// entera, y para poder mandarle el link a quien la captura.

export const metadata = { title: 'Promoción del negocio' }

export default async function BusinessPromoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, profile] = await Promise.all([getBusinessById(id), getCurrentProfile()])

  if (!business) notFound()

  // Mismo criterio que la ficha y el menú: un reviewer lee cualquier municipio,
  // pero el UPDATE de RLS solo lo deja escribir en el suyo.
  const lockedMunicipio =
    profile?.role === 'reviewer' ? (profile.municipio ?? undefined) : undefined
  const readOnly = !!lockedMunicipio && business.municipio !== lockedMunicipio

  const action = updateBusinessPromo.bind(null, id) as (
    prev: PromoFormState,
    formData: FormData,
  ) => Promise<PromoFormState>

  return (
    <div className="space-y-4">
      <PageHeader
        title="Promoción"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Promoción' },
        ]}
        description="Se muestra en la ficha de la app. El cliente le toma captura y el negocio la aplica al recibir el pedido; la app no cambia precios."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {readOnly && <Badge variant="outline">Solo lectura · {business.municipio}</Badge>}
            <Link
              href={`/businesses/${id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Volver al negocio
            </Link>
          </div>
        }
      />

      <BusinessPromoForm
        action={action}
        status={promoStatus(business)}
        readOnly={readOnly}
        defaults={{
          active: business.promo_active,
          title: business.promo_title,
          body: business.promo_body,
          ends_at: business.promo_ends_at,
        }}
      />
    </div>
  )
}
