import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { createCategory } from '@/features/categories/actions'
import { CategoryForm } from '@/features/categories/components/category-form'

export default function NewCategoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/categories" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nueva categoría</h1>
      </div>
      <CategoryForm action={createCategory} submitLabel="Crear" />
    </div>
  )
}
