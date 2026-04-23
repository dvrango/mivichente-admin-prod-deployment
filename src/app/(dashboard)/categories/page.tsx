import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { CategoriesFilters } from '@/features/categories/components/categories-filters'
import { CategoriesTable } from '@/features/categories/components/categories-table'
import { getCategories } from '@/features/categories/queries'
import { parseCategoryFilters } from '@/features/categories/schema'

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const raw = await searchParams
  const filters = parseCategoryFilters(raw)
  const categories = await getCategories(filters)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        description={`${categories.length} ${categories.length === 1 ? 'categoría' : 'categorías'}`}
        actions={
          <Link href="/categories/new" className={buttonVariants()}>
            Nueva categoría
          </Link>
        }
      />

      <CategoriesFilters active={filters.type} />
      <CategoriesTable categories={categories} />
    </div>
  )
}
