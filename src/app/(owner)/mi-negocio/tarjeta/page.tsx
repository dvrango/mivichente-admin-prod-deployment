import { redirect } from 'next/navigation'
import { StampCardFlow } from '@/features/owner-panel/components/stamp-card-flow'
import { getOwnerBusinesses, getOwnerBusinessSnapshot } from '@/features/owner-panel/queries'
import { showsStampCardEntry } from '@/features/owner-panel/stamp-card'

export const metadata = { title: 'Tarjeta de sellos' }

// Dar sello y canjear en caja (mikitasks w26gamoh8). Con el programa prendido,
// o apagado con premios ganados sin canjear (`showsStampCardEntry`); si no,
// regresa al panel. Esto solo decide si se enseña la pantalla: quién puede
// sellar o canjear lo decide la DB en cada llamada.

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
  if (!snapshot || !showsStampCardEntry(snapshot.business)) redirect(panelHref)

  return <StampCardFlow businessName={snapshot.business.name} panelHref={panelHref} />
}
