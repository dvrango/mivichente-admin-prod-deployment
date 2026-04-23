import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { createBusiness } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { getActiveCategoryOptions } from '@/features/businesses/queries'

export default async function NewBusinessPage() {
  const categories = await getActiveCategoryOptions()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/businesses" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo negocio</h1>
      </div>
      <BusinessForm action={createBusiness} submitLabel="Crear" categories={categories} />
    </div>
  )
}
