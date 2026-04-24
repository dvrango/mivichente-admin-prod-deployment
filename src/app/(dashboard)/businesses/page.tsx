import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { BusinessesFilters } from '@/features/businesses/components/businesses-filters'
import { BusinessesPagination } from '@/features/businesses/components/businesses-pagination'
import { BusinessesTable } from '@/features/businesses/components/businesses-table'
import { getAllCategoryOptions, getBusinesses } from '@/features/businesses/queries'
import { businessFiltersSchema } from '@/features/businesses/schema'

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>
}) {
  const raw = await searchParams
  const filters = businessFiltersSchema.parse(raw)

  const [businessesPage, categories] = await Promise.all([
    getBusinesses(filters),
    getAllCategoryOptions(),
  ])

  const { rows, total, page, pageCount } = businessesPage

  function buildHref(nextPage: number) {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.category) params.set('category', filters.category)
    if (nextPage > 1) params.set('page', String(nextPage))
    const qs = params.toString()
    return qs ? `/businesses?${qs}` : '/businesses'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Negocios"
        description={`${total} ${total === 1 ? 'negocio' : 'negocios'}`}
        actions={
          <Link href="/businesses/new" className={buttonVariants()}>
            Nuevo negocio
          </Link>
        }
      />

      <BusinessesFilters search={filters.q} categoryId={filters.category} categories={categories} />

      <BusinessesTable businesses={rows} />

      <BusinessesPagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </div>
  )
}
