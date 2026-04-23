import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { BusinessesFilters } from '@/features/businesses/components/businesses-filters'
import { BusinessesTable } from '@/features/businesses/components/businesses-table'
import { getAllCategoryOptions, getBusinesses } from '@/features/businesses/queries'
import { businessFiltersSchema } from '@/features/businesses/schema'

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const raw = await searchParams
  const filters = businessFiltersSchema.parse(raw)

  const [businesses, categories] = await Promise.all([
    getBusinesses(filters),
    getAllCategoryOptions(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Negocios"
        description={`${businesses.length} ${businesses.length === 1 ? 'negocio' : 'negocios'}`}
        actions={
          <Link href="/businesses/new" className={buttonVariants()}>
            Nuevo negocio
          </Link>
        }
      />

      <BusinessesFilters search={filters.q} categoryId={filters.category} categories={categories} />

      <BusinessesTable businesses={businesses} />
    </div>
  )
}
