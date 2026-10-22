import Image from 'next/image'
import { MessageCircle, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OwnerBusinessSnapshot, OwnerHour, OwnerService } from '../types'
import { ownerWhatsappLink, type OwnerWhatsappTopic } from '../whatsapp'

// Vista de solo lectura de la ficha, para el dueño. Todo en texto plano: el
// punto es que vea lo que ven sus clientes y nos escriba si algo está mal, no
// que aprenda un editor. Lo que falta se dice ("Sin capturar") en vez de
// esconderse, porque eso también es algo que el dueño puede querer corregir.

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

function formatPrice(price: number | null): string {
  if (price === null) return 'Sin precio'
  return price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

/** `09:00:00` -> `09:00` */
function formatTime(time: string): string {
  return time.slice(0, 5)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

function WhatsappButton({
  businessName,
  topic,
  label,
  variant = 'outline',
}: {
  businessName: string
  topic: OwnerWhatsappTopic
  label: string
  variant?: 'default' | 'outline'
}) {
  return (
    <a
      href={ownerWhatsappLink(businessName, topic)}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant, size: 'sm' })}
    >
      <MessageCircle className="size-4" />
      {label}
    </a>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      {/* `anywhere` y no `break-words`: una URL de Instagram con su fbclid es una
          sola palabra larguísima y se salía del ancho del teléfono. */}
      <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">
        {value ?? <span className="text-muted-foreground italic">Sin capturar</span>}
      </dd>
    </div>
  )
}

function whatsappOf(b: OwnerBusinessSnapshot['business']): string | null {
  if (b.whatsapp_phone) return b.whatsapp_phone
  return b.phone_is_whatsapp ? b.phone : null
}

function hoursOfDay(hours: OwnerHour[], day: number): string {
  const shifts = hours.filter((h) => h.day_of_week === day)
  if (shifts.length === 0) return 'Cerrado'
  return shifts.map((h) => `${formatTime(h.opens_at)} a ${formatTime(h.closes_at)}`).join(' y ')
}

function servicePrice(s: OwnerService): string {
  if (s.variants.length > 0) {
    return s.variants.map((v) => `${v.name} ${formatPrice(v.price)}`).join(' · ')
  }
  return formatPrice(s.price)
}

/**
 * Agrupa por sección en el orden en que aparece cada una, igual que el menú de
 * mesa de la landing (`agruparPorSeccion` en landing/src/lib/menu-de-mesa.ts).
 * `order_index` puede intercalar secciones, así que agrupar solo los
 * consecutivos repetiría encabezados.
 */
function bySection(services: OwnerService[]): { section: string | null; items: OwnerService[] }[] {
  const groups = new Map<string, OwnerService[]>()
  for (const s of services) {
    const key = s.section?.trim() || ''
    const items = groups.get(key)
    if (items) items.push(s)
    else groups.set(key, [s])
  }
  return [...groups].map(([key, items]) => ({ section: key || null, items }))
}

export function OwnerBusinessView({ snapshot }: { snapshot: OwnerBusinessSnapshot }) {
  const { business: b, hours, photos, services, feedback } = snapshot
  const servicesLabel = b.services_label ?? 'Servicios'
  const place = [b.address, b.colonia, b.municipio].filter(Boolean).join(', ')
  // `photo_url` es la foto que sale en la tarjeta del negocio. Casi siempre
  // también está en `business_photos`, pero no en todos los negocios viejos: sin
  // esto, a ese dueño le faltaría justo la foto que más ven sus clientes.
  const gallery =
    b.photo_url && !photos.some((p) => p.url === b.photo_url)
      ? [{ id: 'principal', url: b.photo_url, caption: null, kind: 'principal' }, ...photos]
      : photos

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold break-words">{b.name}</h1>
          <p className="text-muted-foreground text-sm">
            Así te ven tus clientes en Vichente. Si ves algo mal o quieres cambiar algo, escríbenos.
          </p>
        </div>
        <WhatsappButton
          businessName={b.name}
          topic="cambio"
          label="Quiero cambiar algo"
          variant="default"
        />
      </div>

      {!b.is_active && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Tu negocio todavía no está publicado en Vichente. Esto es lo que vamos a mostrar cuando
          salga.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos del negocio</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            <Field label="Categoría" value={b.category} />
            <Field label="Descripción" value={b.description} />
            <Field label="Teléfono" value={b.phone} />
            <Field label="WhatsApp" value={whatsappOf(b)} />
            <Field label="Dirección" value={place || null} />
            <Field label="Ubicación en mapa" value={b.maps_url ? 'Capturada' : null} />
            <Field label="Facebook" value={b.facebook_url} />
            <Field label="Instagram" value={b.instagram_url} />
            <Field
              label="También ofrece"
              value={b.offerings && b.offerings.length > 0 ? b.offerings.join(', ') : null}
            />
            <Field label="Entrega a domicilio" value={b.has_delivery ? 'Sí' : 'No'} />
            {b.promo_active && b.promo_title && (
              <Field
                label="Promoción"
                value={
                  <>
                    {b.promo_title}
                    {b.promo_body ? ` — ${b.promo_body}` : ''}
                    {b.promo_ends_at ? ` (hasta el ${formatDate(b.promo_ends_at)})` : ''}
                  </>
                }
              />
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario</CardTitle>
        </CardHeader>
        <CardContent>
          {hours.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">Sin horario capturado.</p>
          ) : (
            <dl className="flex flex-col gap-2">
              {DAYS.map((d) => (
                <Field key={d.value} label={d.label} value={hoursOfDay(hours, d.value)} />
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotos</CardTitle>
        </CardHeader>
        <CardContent>
          {gallery.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">Todavía no hay fotos.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {gallery.map((p) => (
                <li
                  key={p.id}
                  className="bg-muted relative aspect-square overflow-hidden rounded-lg"
                >
                  <Image
                    src={p.url}
                    alt={p.caption ?? ''}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{servicesLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">Todavía no hay nada capturado.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {bySection(services).map((group, i) => (
                <section key={`${group.section ?? ''}-${i}`} className="flex flex-col gap-2">
                  {group.section && <h3 className="text-sm font-semibold">{group.section}</h3>}
                  <ul className="flex flex-col divide-y">
                    {group.items.map((s) => (
                      <li key={s.id} className="flex flex-col gap-0.5 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-sm">{servicePrice(s)}</span>
                        </div>
                        {s.description && (
                          <p className="text-muted-foreground text-sm">{s.description}</p>
                        )}
                        {s.option_groups.map((g) => (
                          <p key={g.name} className="text-muted-foreground text-xs">
                            {g.name}:{' '}
                            {g.options
                              .map((o) =>
                                o.price_delta > 0
                                  ? `${o.name} +${formatPrice(o.price_delta)}`
                                  : o.name,
                              )
                              .join(', ')}
                          </p>
                        ))}
                        {!s.show_in_profile && (
                          <Badge variant="secondary" className="w-fit">
                            Solo en el menú de mesa
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opiniones de tus clientes</CardTitle>
          {feedback.total > 0 && (
            <CardDescription>
              {feedback.total === 1 ? '1 opinión' : `${feedback.total} opiniones`}. Son privadas: no
              se publican.
              {feedback.total > feedback.recent.length &&
                ` Aquí están las ${feedback.recent.length} más recientes.`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {feedback.total === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm">
                Todavía no recibes opiniones. Tus clientes pueden dejarte una opinión privada desde
                un QR en tu local, a cambio de un descuento en su siguiente compra.
              </p>
              <WhatsappButton
                businessName={b.name}
                topic="opiniones"
                label="Me interesa, escríbenos"
              />
            </div>
          ) : (
            <ul className="flex flex-col divide-y">
              {feedback.recent.map((f, i) => (
                <li key={`${f.created_at}-${i}`} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="flex items-center gap-0.5"
                      aria-label={`${f.rating} de 5 estrellas`}
                    >
                      {Array.from({ length: 5 }, (_, n) => (
                        <Star
                          key={n}
                          className={
                            n < f.rating
                              ? 'size-4 fill-amber-400 text-amber-400'
                              : 'text-muted-foreground size-4'
                          }
                        />
                      ))}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(f.created_at)}
                    </span>
                  </div>
                  {f.liked && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Le gustó: </span>
                      {f.liked}
                    </p>
                  )}
                  {f.improve && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Mejoraría: </span>
                      {f.improve}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actividad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm">
            ¿Quieres saber cuánta gente busca tu negocio y te contacta desde Vichente? Escríbenos y
            te contamos.
          </p>
          <WhatsappButton businessName={b.name} topic="actividad" label="Me interesa, escríbenos" />
        </CardContent>
      </Card>
    </div>
  )
}
