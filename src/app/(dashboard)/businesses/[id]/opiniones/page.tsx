import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { requireAdmin } from '@/features/auth/queries'
import {
  updateBusinessFeedbackReward,
  type FeedbackRewardFormState,
} from '@/features/businesses/actions'
import { BusinessFeedbackRewardForm } from '@/features/businesses/components/business-feedback-reward-form'
import { getBusinessById } from '@/features/businesses/queries'

// Página hija de /businesses/[id], hermana de /promocion. Va aparte del form
// del negocio porque solo la usa admin (dar un descuento es un acuerdo
// comercial, como aceptar pedidos), y para que el form de crear o editar la
// ficha nunca mande estas columnas: el trigger rechazaría el guardado del
// reviewer.

export const metadata = { title: 'Opiniones con descuento' }

export default async function BusinessFeedbackRewardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const business = await getBusinessById(id)

  if (!business) notFound()

  const action = updateBusinessFeedbackReward.bind(null, id) as (
    prev: FeedbackRewardFormState,
    formData: FormData,
  ) => Promise<FeedbackRewardFormState>

  return (
    <div className="space-y-4">
      <PageHeader
        title="Opiniones con descuento"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Opiniones' },
        ]}
        description="El cliente escanea el QR del local, deja una opinión privada y se lleva un descuento para su siguiente compra. El negocio lo aplica en caja desde el celular del cliente."
        actions={
          <Link
            href={`/businesses/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Volver al negocio
          </Link>
        }
      />

      <BusinessFeedbackRewardForm
        action={action}
        businessIsActive={business.is_active}
        defaults={{
          active: business.feedback_reward_active,
          benefit: business.feedback_reward_benefit,
          days: business.feedback_reward_days,
        }}
      />
    </div>
  )
}
