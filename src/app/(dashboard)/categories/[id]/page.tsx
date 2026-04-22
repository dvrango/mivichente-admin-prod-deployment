import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/types'
import { CategoryForm } from '../category-form'
import { updateCategory, type CategoryFormState } from '../actions'
import { ToggleActiveButton } from '../toggle-active-button'

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('*').eq('id', id).single()

  if (error || !data) notFound()

  const category = data as Category
  const action = updateCategory.bind(null, id) as (
    prev: CategoryFormState,
    formData: FormData,
  ) => Promise<CategoryFormState>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/categories" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Editar categoría</h1>
        <div className="ml-auto">
          <ToggleActiveButton id={category.id} isActive={category.is_active} />
        </div>
      </div>
      <CategoryForm
        action={action}
        submitLabel="Guardar"
        defaults={{
          name: category.name,
          icon: category.icon,
          type: category.type,
        }}
      />
    </div>
  )
}
