import { PageHeader } from '@/components/shared/page-header'
import { getCurrentProfile } from '@/features/auth/queries'
import { createBusiness } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { getActiveCategoryOptions } from '@/features/businesses/queries'

export default async function NewBusinessPage() {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo negocio"
        breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: 'Nuevo' }]}
      />
      <BusinessForm
        action={createBusiness}
        submitLabel="Crear"
        categories={categories}
        lockedMunicipio={lockedMunicipio}
      />
    </div>
  )
}
