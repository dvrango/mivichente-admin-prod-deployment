import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { updateCategory, type CategoryFormState } from '@/features/categories/actions'
import { CategoryForm } from '@/features/categories/components/category-form'
import { ToggleActiveButton } from '@/features/categories/components/toggle-active-button'
import { getCategoryById } from '@/features/categories/queries'

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const category = await getCategoryById(id)
  if (!category) notFound()

  const action = updateCategory.bind(null, id) as (
    prev: CategoryFormState,
    formData: FormData,
  ) => Promise<CategoryFormState>

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        breadcrumbs={[{ label: 'Categorías', href: '/categories' }, { label: category.name }]}
        actions={<ToggleActiveButton id={category.id} isActive={category.is_active} />}
      />
      <CategoryForm
        action={action}
        submitLabel="Guardar"
        defaults={{
          name: category.name,
          icon: category.icon,
          type: category.type,
          aliases: category.aliases,
        }}
      />
    </div>
  )
}
