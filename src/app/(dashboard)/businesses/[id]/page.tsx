import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import type { Business, Category } from '@/lib/types'
import { BusinessForm } from '../business-form'
import { updateBusiness, type BusinessFormState } from '../actions'
import { ToggleActiveButton } from '../toggle-active-button'

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [businessRes, categoriesRes] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('categories').select('id, name, type').eq('is_active', true).order('name'),
  ])

  if (businessRes.error || !businessRes.data) notFound()

  const business = businessRes.data as Business
  const categories = (categoriesRes.data ?? []) as Pick<Category, 'id' | 'name' | 'type'>[]
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
