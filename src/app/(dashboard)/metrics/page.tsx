import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/features/metrics/components/stat-card'
import { trendLabel } from '@/features/metrics/trend'
import { getWeeklyMetrics } from '@/features/metrics/queries'

const SOURCE_LABELS = { app: 'App', landing: 'Landing' } as const

export default async function MetricsPage() {
  const m = await getWeeklyMetrics()
  const { current, previous, series } = m
  const returningPct =
    current.uniqueDevices > 0
      ? Math.round((current.returningDevices / current.uniqueDevices) * 100)
      : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas"
        description={`Últimos ${m.windowDays} días vs los ${m.windowDays} anteriores · Etapa 1 — Descubrimiento`}
      />

      <p className="text-sm text-muted-foreground">
        Con este volumen no se leen a diario: un martes contra un miércoles no cambia ninguna
        decisión. Se leen una vez por semana, o cuando pasa algo que las mueva. La gráfica es semana
        contra semana, últimas {series.length}.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Devices únicos"
          value={String(current.uniqueDevices)}
          trend={trendLabel(current.uniqueDevices, previous.uniqueDevices)}
          series={series.map((w) => w.uniqueDevices)}
        />
        <StatCard
          label="Devices que regresan"
          value={String(current.returningDevices)}
          trend={trendLabel(current.returningDevices, previous.returningDevices)}
          context={`${returningPct}% de los ${current.uniqueDevices} · la métrica guía de esta etapa`}
        />
        <StatCard
          label="Búsquedas"
          value={String(current.searches)}
          trend={trendLabel(current.searches, previous.searches)}
          series={series.map((w) => w.searches)}
        />
        <StatCard
          label="Búsquedas sin resultado"
          value={String(current.zeroResultSearches)}
          trend={trendLabel(current.zeroResultSearches, previous.zeroResultSearches)}
          context={
            current.searches > 0
              ? `${Math.round((current.zeroResultSearches / current.searches) * 100)}% del total`
              : undefined
          }
          series={series.map((w) => w.zeroResultSearches)}
        />
        <StatCard
          label="Taps a negocios"
          value={String(current.businessTaps)}
          trend={trendLabel(current.businessTaps, previous.businessTaps)}
          series={series.map((w) => w.businessTaps)}
        />
        <StatCard
          label="Contactos iniciados"
          value={String(current.contacts)}
          trend={trendLabel(current.contacts, previous.contacts)}
          context={`llamada ${current.contactsByChannel.call} · whatsapp ${current.contactsByChannel.whatsapp} · mapa ${current.contactsByChannel.maps}`}
          series={series.map((w) => w.contacts)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contactos por fuente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((key) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{SOURCE_LABELS[key]}</span>
                <span className="tabular-nums">{current.contactsBySource[key]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Búsquedas sin resultado, por término</CardTitle>
          </CardHeader>
          <CardContent>
            {current.topZeroResultQueries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna en este periodo.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {current.topZeroResultQueries.map(({ query, count }) => (
                  <li key={query} className="flex justify-between gap-4">
                    <span className="truncate">{query}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        &quot;Búsquedas&quot; loggea por tecla, no por intención — el conteo crudo viene inflado
        (prefijos y typos corregidos cuentan aparte). Los términos sin resultado son la fuente
        continua de qué vocabulario falta, pero léelos con esa salvedad en mente. Las gráficas de
        tendencia comparan semana contra semana, nunca día contra día — efecto fin de semana aparte.
      </p>
    </div>
  )
}
