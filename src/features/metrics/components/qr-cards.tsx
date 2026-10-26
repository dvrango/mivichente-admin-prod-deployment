import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { daysSince, formatLastSeen } from '../format'
import type { OrderQrMetrics } from '../queries'

// Los canales los asigna el trigger de `qr_scans` (migración 20261010120000).
// Uno que no esté aquí sale con su código tal cual, para que se note.
const CHANNEL_LABELS: Record<string, string> = {
  'menu-qr': 'QR de mesa',
  landing: 'Banner de la landing',
  share: 'Links compartidos desde la app',
  'post-fb': 'Posts de Facebook',
  'post-ig': 'Posts de Instagram',
  sticker: 'Stickers',
  'opinion-qr': 'QR de opiniones',
  otro: 'Otro origen (src sin mapear)',
}

// A partir de aquí un QR de mesa se lee como "¿sigue en la mesa?".
const STALE_DAYS = 14

type Props = Pick<OrderQrMetrics, 'qrByChannel' | 'menuQrByBusiness' | 'windowDays' | 'now'>

export function QrCards({ qrByChannel, menuQrByBusiness, windowDays, now }: Props) {
  const bots = qrByChannel.find((c) => c.channel === 'bot')
  const channels = qrByChannel.filter((c) => c.channel !== 'bot')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Scans por canal</CardTitle>
          <CardDescription>
            Últimos {windowDays} días; debajo, los {windowDays} anteriores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {channels.length === 0 ? (
            <p className="text-muted-foreground">Ningún scan en las últimas dos semanas.</p>
          ) : (
            <ul className="space-y-2">
              {channels.map((c) => (
                <li key={c.channel} className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block truncate">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                    <span className="block text-xs text-muted-foreground">{c.channel}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums">{c.scans}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      antes {c.scansPrevious}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Los bots no son personas, pero tampoco ruido: cada vista previa es
              un link de Vichente pegado en un chat o un post. Por eso se
              muestran, pero fuera de la lista. */}
          <div className="flex items-start justify-between gap-4 border-t pt-3 text-muted-foreground">
            <span>
              Vistas previas de links (bots)
              <span className="block text-xs">
                No son personas: alguien pegó un link de Vichente en un chat o un post.
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block tabular-nums">{bots?.scans ?? 0}</span>
              <span className="block text-xs tabular-nums">antes {bots?.scansPrevious ?? 0}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR de mesa por negocio</CardTitle>
          <CardDescription>
            Scans en {windowDays} días y el último, aunque sea más viejo. Sin scans en {STALE_DAYS}{' '}
            días, vale la pena preguntar si el QR sigue en la mesa.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {menuQrByBusiness.length === 0 ? (
            <p className="text-muted-foreground">Ningún negocio tiene scans de QR de mesa.</p>
          ) : (
            <ul className="space-y-2">
              {menuQrByBusiness.map((q) => {
                const stale = daysSince(q.lastScanAt, now) >= STALE_DAYS
                return (
                  <li key={q.businessId} className="flex items-start justify-between gap-4">
                    <span className="min-w-0">
                      <span className={`block truncate ${stale ? 'text-muted-foreground' : ''}`}>
                        {q.businessName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        último scan {formatLastSeen(q.lastScanAt, now)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums">{q.scans}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        antes {q.scansPrevious}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
