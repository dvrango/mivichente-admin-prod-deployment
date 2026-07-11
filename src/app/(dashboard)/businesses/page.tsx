import { Suspense } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { getCurrentProfile } from '@/features/auth/queries'
import { BusinessesFilters } from '@/features/businesses/components/businesses-filters'
import { BusinessesPagination } from '@/features/businesses/components/businesses-pagination'
import { BusinessesStats } from '@/features/businesses/components/businesses-stats'
import { BusinessesTable } from '@/features/businesses/components/businesses-table'
import {
  getAllCategoryOptions,
  getBusinesses,
  getBusinessStats,
} from '@/features/businesses/queries'
import { businessFiltersSchema } from '@/features/businesses/schema'
import { buildFilterUrl } from '@/lib/build-filter-url'

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    category?: string
    status?: string
    review?: string
    verified?: string
    municipio?: string
    page?: string
  }>
}) {
  const raw = await searchParams
  const filters = businessFiltersSchema.parse(raw)

  const [profile, businessesPage, categories, stats] = await Promise.all([
    getCurrentProfile(),
    getBusinesses(filters),
    getAllCategoryOptions(),
    getBusinessStats(filters.municipio || undefined),
  ])

  const isAdmin = profile?.role === 'admin'
  const { rows, total, page, pageCount } = businessesPage

  function buildHref(nextPage: number) {
    return buildFilterUrl('/businesses', {
      q: filters.q || null,
      category: filters.category || null,
      status: filters.status !== 'all' ? filters.status : null,
      review: filters.review !== 'all' ? filters.review : null,
      verified: filters.verified !== 'all' ? filters.verified : null,
      municipio: filters.municipio || null,
      page: nextPage > 1 ? String(nextPage) : null,
    })
  }

  // Se anexa a los links de edición para volver a la lista con los mismos filtros aplicados.
  const returnTo = buildHref(page)

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

      <BusinessesStats
        stats={stats}
        filters={filters}
        zoneLabel={filters.municipio || profile?.municipio || undefined}
      />

      <Suspense>
        {/* Reviewer ve todos los municipios ahora (RLS ampliado en la lista);
        necesita el filtro tanto como el admin para no ver un mix de 3 municipios. */}
        <BusinessesFilters categories={categories} showMunicipio />
      </Suspense>

      <BusinessesTable
        businesses={rows}
        categories={categories}
        canDelete={isAdmin}
        returnTo={returnTo}
        reviewerMunicipio={!isAdmin ? (profile?.municipio ?? undefined) : undefined}
      />

      <BusinessesPagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </div>
  )
}
