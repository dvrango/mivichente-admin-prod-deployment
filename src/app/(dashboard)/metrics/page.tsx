import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DailyBars } from '@/features/metrics/components/daily-bars'
import { FunnelTable } from '@/features/metrics/components/funnel-table'
import { QrCards } from '@/features/metrics/components/qr-cards'
import { StatCard } from '@/features/metrics/components/stat-card'
import { formatMoney } from '@/features/metrics/format'
import { trendLabel } from '@/features/metrics/trend'
import { getOrderQrMetrics, getWeeklyMetrics } from '@/features/metrics/queries'

const SOURCE_LABELS = { app: 'App', landing: 'Landing' } as const

// Cuándo cambió qué cuenta como device (migración 20261026120000, mikitasks
// `es1d67kyq`). Las 6 semanas se recalculan con la definición nueva, así que la
// tendencia no salta; lo que deja de compararse son las cifras anotadas antes.
const DEVICES_DEFINITION_CHANGED = '26 de octubre de 2026'

export default async function MetricsPage() {
  const [m, orders] = await Promise.all([getWeeklyMetrics(), getOrderQrMetrics()])
  const { current, previous, series } = m
  const returningPct =
    current.uniqueDevices > 0
      ? Math.round((current.returningDevices / current.uniqueDevices) * 100)
      : 0
  const funnel = orders.total.current
  const share = (n: number) =>
    funnel.viewed > 0 ? `${Math.round((n / funnel.viewed) * 100)}%` : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas"
        description={`Últimos ${m.windowDays} días vs los ${m.windowDays} anteriores`}
      />

      <h2 className="text-lg font-semibold">Etapa 1 — Descubrimiento</h2>

      <p className="text-sm text-muted-foreground">
        Con este volumen no se leen a diario: un martes contra un miércoles no cambia ninguna
        decisión. Se leen una vez por semana, o cuando pasa algo que las mueva. La gráfica es semana
        contra semana, últimas {series.length}.
      </p>

      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Desde el {DEVICES_DEFINITION_CHANGED}, &quot;devices únicos&quot; y &quot;devices que
        regresan&quot; cuentan cualquier uso: búsquedas, taps, contactos y pasos del pedido. Antes
        solo contaban a quien buscaba, y la mayoría llega directo a un menú. Las gráficas ya están
        recalculadas con la definición nueva, así que la tendencia no salta; lo que no se compara
        son las cifras anotadas antes de esa fecha.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Devices únicos"
          value={String(current.uniqueDevices)}
          trend={trendLabel(current.uniqueDevices, previous.uniqueDevices)}
          context="buscaron, abrieron un menú, tocaron un negocio o lo contactaron"
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

      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Pedidos (piloto)</h2>
          <p className="text-sm text-muted-foreground">
            Una intención es un cliente que abrió WhatsApp con su pedido armado. Se cuenta una vez
            por device y negocio en cada bloque de media hora (de :00 a :30 y de :30 a :00), con el
            monto del último pedido que mandó.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Vieron un menú"
            value={String(funnel.viewed)}
            trend={trendLabel(funnel.viewed, orders.total.previous.viewed)}
            context={`agregó ${share(funnel.added)} · abrió WhatsApp ${share(funnel.whatsapp)}`}
          />
          <StatCard
            label="Intenciones de pedido"
            value={String(funnel.intents)}
            trend={trendLabel(funnel.intents, orders.total.previous.intents)}
            context={
              funnel.intents > 0
                ? `de ${funnel.whatsapp} ${funnel.whatsapp === 1 ? 'device' : 'devices'}`
                : undefined
            }
          />
          <StatCard
            label="Monto de las intenciones"
            value={formatMoney(funnel.intentsCents)}
            trend={trendLabel(funnel.intentsCents, orders.total.previous.intentsCents)}
          />
          <StatCard
            label={`Intenciones en ${orders.longDays} días`}
            value={String(orders.total.intentsLong)}
            context={formatMoney(orders.total.intentsCentsLong)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Por negocio</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelTable rows={orders.byBusiness} total={orders.total} longDays={orders.longDays} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por día, últimos {orders.daily.length} días</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyBars days={orders.daily} />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Las intenciones no son pedidos confirmados: el pedido se cierra en WhatsApp y eso no llega
          aquí. El total cuenta cada device una vez aunque haya visto varios menús, así que no es la
          suma de la tabla. Por día es día de Durango; las semanas y los 30 días de la tarjeta son
          ventanas corridas desde ahora, así que la serie puede no sumar igual. No se distingue
          Android, web o iPhone.
        </p>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-lg font-semibold">QR</h2>
        <QrCards
          qrByChannel={orders.qrByChannel}
          menuQrByBusiness={orders.menuQrByBusiness}
          windowDays={orders.windowDays}
          now={orders.now}
        />
      </section>
    </div>
  )
}
