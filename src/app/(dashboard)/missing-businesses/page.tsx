import { PageHeader } from '@/components/shared/page-header'
import { BusinessesPagination } from '@/features/businesses/components/businesses-pagination'
import { MissingReportsStatusFilter } from '@/features/missing-business-reports/components/missing-reports-status-filter'
import { MissingReportsTable } from '@/features/missing-business-reports/components/missing-reports-table'
import { getMissingReports } from '@/features/missing-business-reports/queries'
import {
  MISSING_STATUS_LABELS,
  missingReportFiltersSchema,
} from '@/features/missing-business-reports/schema'

export default async function MissingBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const raw = await searchParams
  const filters = missingReportFiltersSchema.parse(raw)
  const { rows, total, page, pageCount } = await getMissingReports(filters)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Negocios faltantes"
        description={`${total} ${total === 1 ? 'aviso' : 'avisos'} · ${MISSING_STATUS_LABELS[filters.status]} · Lo que la gente buscó en la app sin encontrarlo`}
      />

      <MissingReportsStatusFilter current={filters.status} />

      <MissingReportsTable reports={rows} />

      <BusinessesPagination
        page={page}
        pageCount={pageCount}
        buildHref={(p) => `/missing-businesses?status=${filters.status}&page=${p}`}
      />
    </div>
  )
}
