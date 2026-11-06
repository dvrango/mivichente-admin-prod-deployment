import { redirect } from 'next/navigation'
import { StampCardFlow } from '@/features/owner-panel/components/stamp-card-flow'
import { getOwnerBusinesses, getOwnerBusinessSnapshot } from '@/features/owner-panel/queries'

export const metadata = { title: 'Tarjeta de sellos' }

// Dar sello y canjear en caja (mikitasks w26gamoh8). Solo con el programa
// prendido: sin él, o con un snapshot viejo que todavía no trae
// `stamp_card_active`, regresa al panel. Esto solo decide si se enseña la
// pantalla; quién puede sellar lo decide la DB en cada llamada.

export default async function SellosPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>
}) {
  const { negocio } = await searchParams
  const businesses = await getOwnerBusinesses()
  if (businesses.length === 0) redirect('/mi-negocio')

  const selected = businesses.find((b) => b.id === negocio) ?? businesses[0]
  const panelHref = `/mi-negocio?negocio=${selected.id}`
  const snapshot = await getOwnerBusinessSnapshot(selected.id)
  if (!snapshot?.business.is_active || snapshot.business.stamp_card_active !== true) {
    redirect(panelHref)
  }

  return <StampCardFlow businessName={snapshot.business.name} panelHref={panelHref} />
}
