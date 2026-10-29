import { ChartColumn, Megaphone, QrCode, ShoppingBag, Stamp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { promoStatus } from '@/features/businesses/promo'
import { cn } from '@/lib/utils'
import type { OwnerBusinessSnapshot } from '../types'
import type { OwnerWhatsappTopic } from '../whatsapp'
import { OwnerWhatsappButton } from './owner-whatsapp-button'

// Funciones para el negocio, existan o no. Las que están "en construcción"
// todavía no se pueden usar: la tarjeta existe para que el dueño diga si le
// interesa, y ese mensaje es la señal de qué construir primero. Sin fechas a
// propósito: no prometer lo que no está agendado. "Editar tu ficha" no va aquí,
// la edición está pospuesta (decisión "Posponer portal de dueños").

type FeatureStatus = 'construccion' | 'disponible' | 'activa'

type Feature = {
  topic: OwnerWhatsappTopic
  icon: LucideIcon
  title: string
  body: React.ReactNode
  status: FeatureStatus
  /** Texto del botón; sin él, "Me interesa". */
  cta?: string
}

const STATUS_LABEL: Record<FeatureStatus, string> = {
  construccion: 'En construcción',
  disponible: 'Disponible',
  activa: 'Activa',
}

const STATUS_CLASS: Record<FeatureStatus, string> = {
  construccion:
    'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900',
  disponible:
    'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900',
  activa: 'bg-emerald-600 text-white border-transparent',
}

function StatusPill({ status }: { status: FeatureStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium',
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function features(b: OwnerBusinessSnapshot['business']): Feature[] {
  return [
    {
      topic: 'pedidos',
      icon: ShoppingBag,
      title: 'Pedidos en tu panel',
      status: 'construccion',
      body: 'Hoy, los negocios que reciben pedidos por Vichente los reciben por WhatsApp. Estamos construyendo un espacio aquí para que veas cada pedido, lo confirmes y lleves la cuenta de los que ya entregaste.',
    },
    {
      topic: 'sellos',
      icon: Stamp,
      title: 'Tarjeta de sellos',
      status: 'construccion',
      body: 'Tus clientes juntan un sello en cada visita y, al llenar la tarjeta, reciben el premio que tú decidas. Tú das los sellos desde este panel.',
    },
    // Mismo criterio de vigente que la app: una promo vencida ya no sale ahí, así
    // que aquí tampoco se presenta como activa.
    promoStatus(b) === 'live' && b.promo_title
      ? {
          topic: 'promocion',
          icon: Megaphone,
          title: 'Promoción',
          status: 'activa',
          cta: 'Cambiar mi promoción',
          body: (
            <>
              <span className="font-medium">{b.promo_title}</span>
              {b.promo_body ? ` — ${b.promo_body}` : ''}
            </>
          ),
        }
      : {
          topic: 'promocion',
          icon: Megaphone,
          title: 'Promoción',
          status: 'disponible',
          body: 'Destaca una oferta en tu ficha de la app de Vichente, como un 2x1 o un descuento de temporada. Nos dices cuál y la publicamos.',
        },
    {
      topic: 'qr',
      icon: QrCode,
      title: 'Sticker QR para tu local',
      status: 'disponible',
      body: 'Un sticker con código QR que lleva a tus clientes directo a tu página en Vichente.',
    },
    {
      topic: 'actividad',
      icon: ChartColumn,
      title: 'Actividad de tu negocio',
      status: 'disponible',
      body: '¿Quieres saber cuánta gente busca tu negocio y te contacta desde Vichente? Escríbenos y te contamos.',
    },
  ]
}

export function OwnerFeatureCards({ business }: { business: OwnerBusinessSnapshot['business'] }) {
  const [highlight, ...rest] = features(business)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FeatureCard feature={highlight} businessName={business.name} wide />
      {rest.map((f) => (
        <FeatureCard key={f.topic} feature={f} businessName={business.name} />
      ))}
    </div>
  )
}

function FeatureCard({
  feature: f,
  businessName,
  wide = false,
}: {
  feature: Feature
  businessName: string
  wide?: boolean
}) {
  const Icon = f.icon
  return (
    <article
      className={cn(
        'bg-card flex flex-col gap-3 rounded-xl border p-4',
        wide && 'from-muted/60 to-card bg-gradient-to-br sm:col-span-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" aria-hidden />
        </span>
        <StatusPill status={f.status} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-base font-semibold">{f.title}</h3>
        <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">{f.body}</p>
      </div>
      <OwnerWhatsappButton
        businessName={businessName}
        topic={f.topic}
        label={f.cta ?? 'Me interesa'}
        variant={wide ? 'default' : 'outline'}
        className="w-full sm:w-fit"
      />
    </article>
  )
}
