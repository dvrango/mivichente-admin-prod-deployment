import { ExternalLink } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { SectionHeader } from '@/components/shared/section-header'
import { getCurrentProfile } from '@/features/auth/queries'
import { MenuEditor } from '@/features/business-menu/components/menu-editor'
import { getMenuItems } from '@/features/business-menu/queries'
import { getBusinessById } from '@/features/businesses/queries'
import { urlMenuPublico } from '@/features/material-grafico/url-menu'

// Página hija de /businesses/[id], hermana de /material — mismo precedente.
// Tiene URL propia a propósito: se le manda a Sandra tal cual y el botón de
// atrás del teléfono regresa al negocio en vez de perder la captura.
//
// La página sólo resuelve datos y permisos. El editor (`MenuEditor`) no depende
// de nada del dashboard: el día que un dueño de negocio entre a editar su propia
// ficha, se reusa el componente y sólo cambia este envoltorio.

// Título neutro: la página sirve a comida, servicios y tiendas, y el
// `services_label` real ya va en el encabezado de la página.
export const metadata = { title: 'Catálogo del negocio' }

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
      <SectionHeader
        title={label}
        info="Se editan uno por uno y cada cambio se guarda ahí mismo."
        actions={
          /* Para revisar lo guardado como lo ve el cliente, sin salir del
             editor. Un negocio inactivo no lo puede leer el cliente anónimo
             y el link daría 404, así que ahí se dice por qué no hay botón. */
          business.is_active ? (
            <a
              href={urlMenuPublico(business.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-4" />
              Ver como lo ve el cliente
            </a>
          ) : (
            <Badge variant="outline">Oculto · el cliente todavía no lo ve</Badge>
          )
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
