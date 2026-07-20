import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import {
  getActiveCategoryOptions,
  getBusinessById,
  getBusinessCategoryIds,
} from '@/features/businesses/queries'
import { FieldCapture } from '@/features/field/components/field-capture'
import { getFieldPhotos } from '@/features/field/queries'

export const metadata = { title: 'Captura — campo' }

export default async function CampoBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const business = await getBusinessById(id)
  if (!business) notFound()

  // El reviewer puede LEER negocios de cualquier municipio (businesses_select es
  // using(true)) pero sólo actualizar los suyos. Se corta aquí para no dejarlo
  // capturar 10 minutos y chocar con RLS al guardar.
  if (profile.role !== 'admin' && business.municipio !== profile.municipio) {
    redirect('/campo')
  }

  const [photos, categories, categoryIds] = await Promise.all([
    getFieldPhotos(id),
    getActiveCategoryOptions(),
    getBusinessCategoryIds(id),
  ])

  return (
    <FieldCapture
      business={business}
      photos={photos}
      categories={categories}
      primaryCategoryId={categoryIds.primaryId ?? business.category_id}
    />
  )
}
