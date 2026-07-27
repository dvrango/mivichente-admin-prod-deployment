import { PageHeader } from '@/components/shared/page-header'
import { getCurrentProfile } from '@/features/auth/queries'
import { createBusiness } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { getActiveCategoryOptions } from '@/features/businesses/queries'
import { MUNICIPIOS } from '@/features/businesses/schema'

// Los parámetros con los que `approveRegistration` precarga este form cuando la
// solicitud no traía `business_id` (ver registrations/actions.ts). Sin ellos la
// página es el alta normal de siempre.
type NewBusinessSearchParams = {
  fromRegistration?: string
  name?: string
  phone?: string
  municipio?: string
  contact_name?: string
  contact_phone?: string
  description?: string
  /** Ofertas declaradas por el dueño, separadas por `|`. */
  offerings?: string
  giro?: string
}

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<NewBusinessSearchParams>
}) {
  const params = await searchParams
  const [categories, profile] = await Promise.all([getActiveCategoryOptions(), getCurrentProfile()])
  const lockedMunicipio =
    profile?.role === 'reviewer' ? (profile.municipio ?? undefined) : undefined

  // Reviewer sin municipio asignado: todo insert fallaría en el RLS
  // (municipio = NULL nunca matchea). Se bloquea el form con un aviso claro.
  if (profile?.role === 'reviewer' && !profile.municipio) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nuevo negocio"
          breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: 'Nuevo' }]}
        />
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Tu cuenta todavía no tiene un municipio asignado, así que no puedes dar de alta negocios.
          Pídele al administrador que te asigne uno.
        </p>
      </div>
    )
  }

  const fromRegistration = params.fromRegistration
  const municipio = (MUNICIPIOS as readonly string[]).includes(params.municipio ?? '')
    ? params.municipio
    : undefined
  const defaults = fromRegistration
    ? {
        name: params.name ?? '',
        phone: params.phone ?? '',
        municipio,
        description: params.description ?? '',
        offerings: params.offerings ? params.offerings.split('|').filter(Boolean) : [],
        owner: params.contact_name ?? '',
        owner_phone: params.contact_phone ?? '',
      }
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo negocio"
        breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: 'Nuevo' }]}
        description={
          fromRegistration
            ? `Precargado con lo que mandó el dueño en su solicitud${
                params.giro ? ` · giro declarado: ${params.giro}` : ''
              }. Revisa, elige categoría y guarda — al guardar, la solicitud queda aprobada.`
            : undefined
        }
      />
      <BusinessForm
        action={createBusiness}
        submitLabel="Crear"
        categories={categories}
        lockedMunicipio={lockedMunicipio}
        registrationId={fromRegistration}
        defaults={defaults}
      />
    </div>
  )
}
