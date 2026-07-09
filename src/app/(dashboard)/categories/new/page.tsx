import { PageHeader } from '@/components/shared/page-header'
import { createCategory } from '@/features/categories/actions'
import { CategoryForm } from '@/features/categories/components/category-form'
import { getCategoryTerms } from '@/features/categories/queries'

export default async function NewCategoryPage() {
  const existing = await getCategoryTerms()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva categoría"
        breadcrumbs={[{ label: 'Categorías', href: '/categories' }, { label: 'Nueva' }]}
      />
      <CategoryForm action={createCategory} submitLabel="Crear" existing={existing} />
    </div>
  )
}
