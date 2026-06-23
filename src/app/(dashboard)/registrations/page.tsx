import { PageHeader } from '@/components/shared/page-header'
import { RegistrationsTable } from '@/features/registrations/components/registrations-table'
import { RegistrationsStatusFilter } from '@/features/registrations/components/registrations-status-filter'
import { getRegistrations } from '@/features/registrations/queries'
import { registrationFiltersSchema, STATUS_LABELS } from '@/features/registrations/schema'

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const raw = await searchParams
  const filters = registrationFiltersSchema.parse(raw)
  const { rows, total } = await getRegistrations(filters)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes"
        description={`${total} ${total === 1 ? 'solicitud' : 'solicitudes'} · ${STATUS_LABELS[filters.status]}`}
      />

      <RegistrationsStatusFilter current={filters.status} />

      <RegistrationsTable registrations={rows} />
    </div>
  )
}
