import { Suspense } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { BusinessesFilters } from '@/features/businesses/components/businesses-filters'
import { BusinessesPagination } from '@/features/businesses/components/businesses-pagination'
import { BusinessesTable } from '@/features/businesses/components/businesses-table'
import { getAllCategoryOptions, getBusinesses } from '@/features/businesses/queries'
import { businessFiltersSchema } from '@/features/businesses/schema'
import { buildFilterUrl } from '@/lib/build-filter-url'

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
    return buildFilterUrl('/businesses', {
      q: filters.q || null,
      category: filters.category || null,
      page: nextPage > 1 ? String(nextPage) : null,
    })
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

      <Suspense>
        <BusinessesFilters categories={categories} />
      </Suspense>

      <BusinessesTable businesses={rows} />

      <BusinessesPagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </div>
  )
}
