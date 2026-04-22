import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/types'
import { BusinessForm } from '../business-form'
import { createBusiness } from '../actions'

export default async function NewBusinessPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('is_active', true)
    .order('name')
  const categories = (data ?? []) as Pick<Category, 'id' | 'name' | 'type'>[]

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
