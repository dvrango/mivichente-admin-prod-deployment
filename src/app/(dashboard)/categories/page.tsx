import Link from 'next/link'
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categorías</h1>
          <p className="text-muted-foreground text-sm">
            {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
          </p>
        </div>
        <Link href="/categories/new" className={buttonVariants()}>
          Nueva categoría
        </Link>
      </div>

      <CategoriesFilters active={filters.type} />
      <CategoriesTable categories={categories} />
    </div>
  )
}
