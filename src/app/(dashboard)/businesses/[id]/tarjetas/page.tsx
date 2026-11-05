import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { requireAdmin } from '@/features/auth/queries'
import { getBusinessById } from '@/features/businesses/queries'
import { HojaTarjetasPanel } from '@/features/tarjeta-fisica/components/hoja-tarjetas-panel'
import { TARJETAS_POR_HOJA } from '@/features/tarjeta-fisica/geometria'

// Página hija de /businesses/[id], hermana de /sellos y con la misma forma. Va
// aparte de /material porque solo la usa admin: generar la hoja crea tarjetas
// físicas en la DB (`admin_create_physical_cards`), y /material la ve también
// el reviewer. La tarjeta es neutra en la mecánica, por eso no vive en /sellos.

export const metadata = { title: 'Tarjetas físicas' }

export default async function BusinessPhysicalCardsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const business = await getBusinessById(id)
  if (!business) notFound()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tarjetas físicas"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Tarjetas físicas' },
        ]}
        description="La tarjeta de cliente impresa del negocio. El dueño se la da al cliente, el cliente la escanea con su celular y queda ligada a su tarjeta digital."
        actions={
          <Link
            href={`/businesses/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Volver al negocio
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Hoja para la imprenta</CardTitle>
          <CardDescription>
            Un PDF tabloide con {business.name} en {TARJETAS_POR_HOJA} tarjetas de 3.5 × 2 pulgadas,
            listo para imprimir a dos caras, laminar y cortar. Cada tarjeta lleva un QR distinto. El
            logo es la portada del negocio: si no lo es, cámbiala en Editar negocio → Fotos antes de
            generar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HojaTarjetasPanel
            businessId={business.id}
            slug={business.slug}
            nombre={business.name}
            portadaUrl={business.photo_url}
          />
        </CardContent>
      </Card>
    </div>
  )
}
