import { notFound } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { countMenuItems } from '@/features/business-menu/queries'
import { BusinessHeader } from '@/features/businesses/components/business-header'
import { BusinessTabs, type BusinessTab } from '@/features/businesses/components/business-tabs'
import { promoStatus } from '@/features/businesses/promo'
import { getBusinessById } from '@/features/businesses/queries'

// Encabezado y tabs compartidos por la ficha y sus subpáginas. Antes cada
// subpágina traía su breadcrumb y un «Volver al negocio», y a ellas se llegaba
// desde una fila de 12 botones en el header de la ficha (mikitasks `dcxiaos2k`).
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [business, profile, menuItemCount] = await Promise.all([
    getBusinessById(id),
    getCurrentProfile(),
    countMenuItems(id),
  ])

  if (!business) notFound()

  const isAdmin = profile?.role === 'admin'
  // Mismo criterio que la ficha (`page.tsx`): el reviewer lee cualquier
  // municipio, pero el UPDATE de RLS solo lo deja escribir en el suyo.
  const readOnly =
    profile?.role === 'reviewer' && !!profile.municipio && business.municipio !== profile.municipio

  const base = `/businesses/${id}`
  const tabs: BusinessTab[] = [
    { href: base, label: 'Datos' },
    {
      href: `${base}/menu`,
      label: business.services_label?.trim() || 'Servicios',
      count: menuItemCount,
    },
    { href: `${base}/promocion`, label: 'Promoción', live: promoStatus(business) === 'live' },
  ]
  // Solo admin: estas páginas llaman `requireAdmin()` y sus columnas las
  // protegen triggers. Aquí solo se esconden para no ofrecer un 404.
  // El punto de «activa» usa el mismo criterio que el servidor: un negocio
  // inactivo no da tarjetas ni recibe opiniones.
  if (isAdmin) {
    tabs.push(
      {
        href: `${base}/sellos`,
        label: 'Tarjeta de sellos',
        live: business.stamp_card_active && business.is_active,
      },
      { href: `${base}/tarjetas`, label: 'Tarjetas físicas' },
      {
        href: `${base}/opiniones`,
        label: 'Opiniones',
        live: business.feedback_reward_active && business.is_active,
      },
    )
  }
  tabs.push({ href: `${base}/material`, label: 'Material gráfico' })

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <BusinessHeader business={business} readOnly={readOnly} />
        <BusinessTabs tabs={tabs} />
      </div>
      {children}
    </div>
  )
}
