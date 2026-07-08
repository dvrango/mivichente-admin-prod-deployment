import Link from 'next/link'
import { buildFilterUrl } from '@/lib/build-filter-url'
import { cn } from '@/lib/utils'
import type { BusinessStats } from '../queries'
import type { BusinessFilters } from '../schema'

// Tablero de progreso de curación del scraping inicial. Cada tile es un acceso
// al filtro correspondiente: al hacer click carga la lista ya filtrada (ej.
// "Activos" -> status=active). El municipio y la búsqueda se conservan.
type Props = { stats: BusinessStats; filters: BusinessFilters; zoneLabel?: string }

// Facetas que fija cada tile; las no listadas vuelven a su default.
type Facet = Partial<Pick<BusinessFilters, 'status' | 'review' | 'verified'>>

type Tile = {
  label: string
  value: number
  hint?: string
  accent?: string
  facet: Facet
}

export function BusinessesStats({ stats, filters, zoneLabel }: Props) {
  const reviewPct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0

  const tiles: Tile[] = [
    { label: 'Total', value: stats.total, facet: {} },
    {
      label: 'Sin revisar',
      value: stats.pending,
      hint: 'scraping',
      accent: stats.pending > 0 ? 'text-amber-600 dark:text-amber-500' : undefined,
      facet: { review: 'pending' },
    },
    {
      label: 'Revisados',
      value: stats.reviewed,
      hint: `${reviewPct}%`,
      facet: { review: 'reviewed' },
    },
    { label: 'Activos', value: stats.active, facet: { status: 'active' } },
    { label: 'Inactivos', value: stats.inactive, facet: { status: 'inactive' } },
    { label: 'Verificados', value: stats.verified, facet: { verified: 'yes' } },
  ]

  function hrefFor(facet: Facet) {
    const status = facet.status ?? 'all'
    const review = facet.review ?? 'all'
    const verified = facet.verified ?? 'all'
    return buildFilterUrl('/businesses', {
      q: filters.q || null,
      municipio: filters.municipio || null,
      status: status !== 'all' ? status : null,
      review: review !== 'all' ? review : null,
      verified: verified !== 'all' ? verified : null,
    })
  }

  function isActive(facet: Facet) {
    return (
      (facet.status ?? 'all') === filters.status &&
      (facet.review ?? 'all') === filters.review &&
      (facet.verified ?? 'all') === filters.verified
    )
  }

  return (
    <section aria-label="Progreso de curación" className="space-y-2">
      {zoneLabel && <h2 className="text-sm font-medium text-muted-foreground">{zoneLabel}</h2>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={hrefFor(t.facet)}
            aria-current={isActive(t.facet) ? 'true' : undefined}
            className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="text-xs text-muted-foreground">
              {t.label}
              {t.hint && <span className="ml-1 opacity-70">· {t.hint}</span>}
            </div>
            <div className={cn('mt-1 text-2xl font-semibold tabular-nums', t.accent)}>
              {t.value}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
