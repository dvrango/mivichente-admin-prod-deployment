import { ChartColumn, QrCode, ShoppingBag, Stamp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OwnerWhatsappTopic } from '../whatsapp'
import { CopyLinkButton } from './copy-link-button'
import { OwnerWhatsappButton } from './owner-whatsapp-button'

// Funciones para el negocio, existan o no. Las que están "en construcción"
// todavía no se pueden usar: la tarjeta existe para que el dueño diga si le
// interesa, y ese mensaje es la señal de qué construir primero. Sin fechas a
// propósito: no prometer lo que no está agendado. "Editar tu ficha" no va aquí,
// la edición está pospuesta (decisión "Posponer portal de dueños"). La
// promoción tampoco: tiene su propia sección, porque es parte de lo que el
// cliente ve en la ficha.

type FeatureStatus = 'construccion' | 'disponible'

type Feature = {
  topic: OwnerWhatsappTopic
  icon: LucideIcon
  title: string
  body: React.ReactNode
  status: FeatureStatus
  /** Va debajo del texto, fuera del párrafo. */
  extra?: React.ReactNode
}

const STATUS_LABEL: Record<FeatureStatus, string> = {
  construccion: 'En construcción',
  disponible: 'Disponible',
}

const STATUS_CLASS: Record<FeatureStatus, string> = {
  construccion:
    'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900',
  disponible:
    'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900',
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

function features(menuUrl: string | null): Feature[] {
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
      body: 'Es como la tarjeta de papel de «junta 10 sellos y llévate uno gratis», pero en el celular. Tu cliente la saca escaneando un QR en tu mostrador, sin instalar nada; tú le das un sello desde este panel cada vez que te compra, y al llenarla gana el premio que tú decidas. Le das una razón para regresar contigo en vez de ir a otro lado, y te olvidas de imprimir tarjetas que se pierden.',
    },
    {
      topic: 'qr',
      icon: QrCode,
      title: 'QR de menú para tus mesas',
      status: 'disponible',
      body: 'Un sticker con código QR para cada mesa. Tu cliente lo escanea y ve tu menú con precios en su celular, sin instalar nada y sin esperar a que le lleves la carta. Cuando cambias un precio, nos avisas y el QR ya muestra el nuevo: no tienes que volver a imprimir menús.',
      extra: menuUrl ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Si algún día haces tus propios QR, que abran este link:
          </p>
          <p className="bg-muted rounded-md px-2.5 py-1.5 font-mono text-xs [overflow-wrap:anywhere]">
            {menuUrl.replace('https://', '')}
          </p>
          <div className="flex">
            <CopyLinkButton url={menuUrl} variant="outline" />
          </div>
        </div>
      ) : null,
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

export function OwnerFeatureCards({
  businessName,
  menuUrl,
}: {
  businessName: string
  /** Link al que apunta el QR de mesa; null si el negocio no tiene menú publicado. */
  menuUrl: string | null
}) {
  const [highlight, ...rest] = features(menuUrl)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FeatureCard feature={highlight} businessName={businessName} wide />
      {rest.map((f) => (
        <FeatureCard key={f.topic} feature={f} businessName={businessName} />
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
      {f.extra}
      <OwnerWhatsappButton
        businessName={businessName}
        topic={f.topic}
        label="Me interesa"
        variant={wide ? 'default' : 'outline'}
        className="w-full sm:w-fit"
      />
    </article>
  )
}
