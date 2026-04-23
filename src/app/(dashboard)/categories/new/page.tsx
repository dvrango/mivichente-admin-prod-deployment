import { PageHeader } from '@/components/shared/page-header'
import { createCategory } from '@/features/categories/actions'
import { CategoryForm } from '@/features/categories/components/category-form'

export default function NewCategoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva categoría"
        breadcrumbs={[{ label: 'Categorías', href: '/categories' }, { label: 'Nueva' }]}
      />
      <CategoryForm action={createCategory} submitLabel="Crear" />
    </div>
  )
}
