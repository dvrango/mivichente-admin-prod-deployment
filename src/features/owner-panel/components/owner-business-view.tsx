import Image from 'next/image'
import { Clock, ExternalLink, ImageIcon, MessageSquareText, Star, Store, List } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { OwnerBusinessSnapshot, OwnerHour, OwnerService } from '../types'
import { ownerLinks } from '../links'
import { OwnerFeatureCards } from './owner-feature-cards'
import { OwnerLinks } from './owner-links'
import { OwnerWhatsappButton } from './owner-whatsapp-button'

// Vista de solo lectura de la ficha, para el dueño. Todo en texto plano: el
// punto es que vea lo que ven sus clientes y nos escriba si algo está mal, no
// que aprenda un editor. Lo que falta se dice ("Sin capturar") en vez de
// esconderse, porque eso también es algo que el dueño puede querer corregir.
// Los conteos del resumen son de su propio contenido (fotos, platillos), no de
// actividad: esos números siguen fuera del panel.

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

const SECTIONS = {
  links: 'links',
  herramientas: 'herramientas',
  ficha: 'ficha',
  horario: 'horario',
  fotos: 'fotos',
  menu: 'menu',
  opiniones: 'opiniones',
} as const

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      {/* `anywhere` y no `break-words`: una URL de Instagram con su fbclid es una
          sola palabra larguísima y se salía del ancho del teléfono. */}
      <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">
        {value ?? <span className="text-muted-foreground italic">Sin capturar</span>}
      </dd>
    </div>
  )
}

function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div id={id} className="flex scroll-mt-16 flex-col gap-0.5 pt-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
    </div>
  )
}

function StatTile({
  href,
  icon: Icon,
  label,
  value,
  missing = false,
}: {
  href: string
  icon: LucideIcon
  label: string
  value: string
  missing?: boolean
}) {
  return (
    <a
      href={href}
      className="bg-card hover:bg-muted/50 flex flex-col gap-2 rounded-xl border p-3 transition-colors"
    >
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <span
        className={cn('text-base font-semibold', missing && 'text-amber-700 dark:text-amber-400')}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </a>
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
  const cover = b.photo_url ?? gallery[0]?.url ?? null
  // Sin publicar, `ownerLinks` no da ninguno: la página pública daría 404.
  const links = ownerLinks(b, { servicesLabel, hasServices: services.length > 0 })
  const publicUrl = links.find((l) => l.key === 'pagina')?.url ?? null

  const nav = [
    { id: SECTIONS.links, label: 'Tus links' },
    { id: SECTIONS.herramientas, label: 'Para tu negocio' },
    { id: SECTIONS.ficha, label: 'Tu ficha' },
    { id: SECTIONS.horario, label: 'Horario' },
    { id: SECTIONS.fotos, label: 'Fotos' },
    { id: SECTIONS.menu, label: servicesLabel },
    { id: SECTIONS.opiniones, label: 'Opiniones' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative h-28 sm:h-36">
          {cover && (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {b.is_active ? (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Publicado en Vichente
                </span>
              ) : (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                  Sin publicar
                </span>
              )}
              {b.category && <Badge variant="secondary">{b.category}</Badge>}
            </div>
            <h1 className="text-2xl font-semibold break-words">{b.name}</h1>
            <p className="text-muted-foreground text-sm">
              {b.is_active
                ? 'Así te ven tus clientes en Vichente. Si ves algo mal o quieres cambiar algo, escríbenos.'
                : 'Tu negocio todavía no está publicado. Esto es lo que vamos a mostrar cuando salga.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <OwnerWhatsappButton
              businessName={b.name}
              topic="cambio"
              label="Quiero cambiar algo"
              variant="default"
              className="w-full sm:w-fit"
            />
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full sm:w-fit',
                )}
              >
                <ExternalLink className="size-4" />
                Ver mi página
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          href={`#${SECTIONS.horario}`}
          icon={Clock}
          label="Horario"
          value={hours.length > 0 ? 'Capturado' : 'Falta'}
          missing={hours.length === 0}
        />
        <StatTile
          href={`#${SECTIONS.fotos}`}
          icon={ImageIcon}
          label={gallery.length === 1 ? 'Foto' : 'Fotos'}
          value={String(gallery.length)}
          missing={gallery.length === 0}
        />
        <StatTile
          href={`#${SECTIONS.menu}`}
          icon={List}
          label={servicesLabel}
          value={String(services.length)}
          missing={services.length === 0}
        />
        <StatTile
          href={`#${SECTIONS.opiniones}`}
          icon={MessageSquareText}
          label={feedback.total === 1 ? 'Opinión' : 'Opiniones'}
          value={String(feedback.total)}
        />
      </div>

      {/* Dentro del <main> que hace scroll: `sticky` se pega a él, no a la ventana. */}
      <nav
        aria-label="Secciones"
        className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 -mx-4 border-b px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6"
      >
        <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {nav.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className="hover:bg-muted inline-flex h-8 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <SectionTitle
        id={SECTIONS.links}
        title="Tus links"
        hint="Cópialos y compártelos para que tus clientes te encuentren."
      />
      <OwnerLinks links={links} />

      <SectionTitle
        id={SECTIONS.herramientas}
        title="Para tu negocio"
        hint="Lo que ya puedes pedir y lo que estamos construyendo. Si algo te interesa, escríbenos."
      />
      <OwnerFeatureCards business={b} />

      <SectionTitle id={SECTIONS.ficha} title="Tu ficha" />
      <Card>
        <CardContent>
          <dl className="flex flex-col divide-y">
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

      <SectionTitle id={SECTIONS.horario} title="Horario" />
      <Card>
        <CardContent>
          {hours.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">Sin horario capturado.</p>
          ) : (
            <dl className="flex flex-col divide-y">
              {DAYS.map((d) => (
                <Field key={d.value} label={d.label} value={hoursOfDay(hours, d.value)} />
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <SectionTitle id={SECTIONS.fotos} title="Fotos" />
      {gallery.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3">
            <Store className="text-muted-foreground size-5" aria-hidden />
            <p className="text-muted-foreground text-sm italic">Todavía no hay fotos.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {gallery.map((p) => (
            <li key={p.id} className="bg-muted relative aspect-square overflow-hidden rounded-xl">
              <Image
                src={p.url}
                alt={p.caption ?? ''}
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      <SectionTitle id={SECTIONS.menu} title={servicesLabel} />
      <Card>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">Todavía no hay nada capturado.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {bySection(services).map((group, i) => (
                <section key={`${group.section ?? ''}-${i}`} className="flex flex-col gap-1">
                  {group.section && (
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {group.section}
                    </h3>
                  )}
                  <ul className="flex flex-col divide-y">
                    {group.items.map((s) => (
                      <li key={s.id} className="flex flex-col gap-0.5 py-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-sm tabular-nums">{servicePrice(s)}</span>
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

      <SectionTitle id={SECTIONS.opiniones} title="Opiniones de tus clientes" />
      <Card>
        {feedback.total > 0 && (
          <CardHeader>
            <CardTitle className="sr-only">Opiniones</CardTitle>
            <CardDescription>
              {feedback.total === 1 ? '1 opinión' : `${feedback.total} opiniones`}. Son privadas: no
              se publican.
              {feedback.total > feedback.recent.length &&
                ` Aquí están las ${feedback.recent.length} más recientes.`}
            </CardDescription>
          </CardHeader>
        )}
        <CardContent>
          {feedback.total === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm">
                Todavía no recibes opiniones. Tus clientes pueden dejarte una opinión privada desde
                un QR en tu local, a cambio de un descuento en su siguiente compra.
              </p>
              <OwnerWhatsappButton businessName={b.name} topic="opiniones" label="Me interesa" />
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
    </div>
  )
}
