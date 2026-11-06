import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { requireAdmin } from '@/features/auth/queries'
import { updateBusinessStampCard, type StampCardFormState } from '@/features/businesses/actions'
import { BusinessStampCardForm } from '@/features/businesses/components/business-stamp-card-form'
import { businessHasOwner, getBusinessById } from '@/features/businesses/queries'
import { QrMostradorPanel } from '@/features/material-grafico/components/qr-mostrador-panel'
import { urlTarjetaMostrador } from '@/features/material-grafico/url-menu'

// Página hija de /businesses/[id], hermana de /opiniones y con la misma forma
// (A1 y A2 del mockup `mvp-design/tarjeta-de-sellos/`). Va aparte del form del
// negocio porque solo la usa admin, y para que el form de la ficha nunca mande
// estas columnas: el trigger `businesses_stamp_card_admin_only` rechazaría el
// guardado del reviewer.

export const metadata = { title: 'Tarjeta de sellos' }

export default async function BusinessStampCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const [business, hasOwner] = await Promise.all([getBusinessById(id), businessHasOwner(id)])

  if (!business) notFound()

  const action = updateBusinessStampCard.bind(null, id) as (
    prev: StampCardFormState,
    formData: FormData,
  ) => Promise<StampCardFormState>

  // El QR sale solo con lo GUARDADO prendido y el negocio activo: un QR impreso
  // que lleva a «no está dando tarjetas» es peor que no tenerlo (A2).
  const qrDisponible = business.stamp_card_active && business.is_active

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tarjeta de sellos"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Tarjeta de sellos' },
        ]}
        description="El cliente escanea el QR del mostrador y se lleva una tarjeta en su celular. El dueño le da un sello por compra desde su panel y le canjea el premio cuando la llena. El premio lo elige y lo paga el negocio."
        actions={
          <Link
            href={`/businesses/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Volver al negocio
          </Link>
        }
      />

      <div className="grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <BusinessStampCardForm
          action={action}
          businessIsActive={business.is_active}
          hasOwner={hasOwner}
          defaults={{
            active: business.stamp_card_active,
            stampsRequired: business.stamp_card_stamps_required,
            reward: business.stamp_card_reward,
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle>QR del mostrador</CardTitle>
            <CardDescription>El que escanea el cliente para obtener su tarjeta.</CardDescription>
          </CardHeader>
          <CardContent>
            {qrDisponible ? (
              <QrMostradorPanel
                url={urlTarjetaMostrador(business.slug)}
                archivo={`vichente-qr-tarjeta-${business.slug}`}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {business.is_active
                  ? 'Prende la tarjeta de sellos y guarda para descargar el QR.'
                  : 'El negocio está inactivo: actívalo y prende la tarjeta de sellos para descargar el QR.'}
              </p>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              Una vez impreso, el slug del negocio ya no se puede cambiar sin romper el QR.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
