import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { updateBusiness, type BusinessFormState } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { ToggleActiveButton } from '@/features/businesses/components/toggle-active-button'
import { getActiveCategoryOptions, getBusinessById } from '@/features/businesses/queries'

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, categories] = await Promise.all([
    getBusinessById(id),
    getActiveCategoryOptions(),
  ])

  if (!business) notFound()

  const action = updateBusiness.bind(null, id) as (
    prev: BusinessFormState,
    formData: FormData,
  ) => Promise<BusinessFormState>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/businesses" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Editar negocio</h1>
        <div className="ml-auto">
          <ToggleActiveButton id={business.id} isActive={business.is_active} />
        </div>
      </div>
      <BusinessForm
        action={action}
        submitLabel="Guardar"
        categories={categories}
        defaults={{
          name: business.name,
          category_id: business.category_id,
          phone: business.phone,
          address: business.address,
          schedule: business.schedule,
          photo_url: business.photo_url,
        }}
      />
    </div>
  )
}
