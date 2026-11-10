import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionHeader } from '@/components/shared/section-header'
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
      <SectionHeader
        title="Tarjetas físicas"
        info="La tarjeta de cliente impresa del negocio. El dueño se la da al cliente, el cliente la escanea con su celular y queda ligada a su tarjeta digital."
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
