import { PageHeader } from '@/components/shared/page-header'
import { BusinessesPagination } from '@/features/businesses/components/businesses-pagination'
import { ReportsTable } from '@/features/business-reports/components/reports-table'
import { ReportsReasonFilter } from '@/features/business-reports/components/reports-reason-filter'
import { getReports } from '@/features/business-reports/queries'
import { reportFiltersSchema } from '@/features/business-reports/schema'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; page?: string }>
}) {
  const raw = await searchParams
  const filters = reportFiltersSchema.parse(raw)
  const { rows, total, page, pageCount } = await getReports(filters)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description={`${total} ${total === 1 ? 'reporte' : 'reportes'}`}
      />

      <ReportsReasonFilter current={filters.reason} />

      <ReportsTable reports={rows} />

      <BusinessesPagination
        page={page}
        pageCount={pageCount}
        buildHref={(p) =>
          filters.reason ? `/reports?reason=${filters.reason}&page=${p}` : `/reports?page=${p}`
        }
      />
    </div>
  )
}
