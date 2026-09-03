import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { getCurrentProfile } from '@/features/auth/queries'
import { MenuEditor } from '@/features/business-menu/components/menu-editor'
import { getMenuItems } from '@/features/business-menu/queries'
import { getBusinessById } from '@/features/businesses/queries'

// Página hija de /businesses/[id], hermana de /material — mismo precedente.
// Tiene URL propia a propósito: se le manda a Sandra tal cual y el botón de
// atrás del teléfono regresa al negocio en vez de perder la captura.
//
// La página sólo resuelve datos y permisos. El editor (`MenuEditor`) no depende
// de nada del dashboard: el día que un dueño de negocio entre a editar su propia
// ficha, se reusa el componente y sólo cambia este envoltorio.

export const metadata = { title: 'Menú del negocio' }

export default async function BusinessMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, items, profile] = await Promise.all([
    getBusinessById(id),
    getMenuItems(id),
    getCurrentProfile(),
  ])

  if (!business) notFound()

  // Mismo criterio que la ficha del negocio (`../page.tsx`): un reviewer LEE
  // negocios de cualquier municipio, pero el UPDATE de RLS sólo lo deja escribir
  // en el suyo. Sin este gate la pantalla se ve editable y falla al guardar.
  const lockedMunicipio =
    profile?.role === 'reviewer' ? (profile.municipio ?? undefined) : undefined
  const readOnly = !!lockedMunicipio && business.municipio !== lockedMunicipio

  // El título se LEE de `services_label`, nunca se escribe acá: sus dos
  // escritores siguen siendo el form del negocio y modo campo.
  const label = business.services_label?.trim() || 'Servicios'

  return (
    <div className="space-y-4">
      <PageHeader
        title={label}
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label },
        ]}
        description={business.name}
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

      <MenuEditor
        businessId={business.id}
        businessName={business.name}
        servicesLabel={business.services_label}
        initialItems={items}
        readOnly={readOnly}
      />
    </div>
  )
}
