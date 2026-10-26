import { formatDay, formatMoney } from '../format'
import type { OrderQrMetrics } from '../queries'

type Props = { days: OrderQrMetrics['daily'] }

function dayTitle(d: Props['days'][number]): string {
  const intents =
    d.intents === 0
      ? 'sin intenciones'
      : `${d.intents} ${d.intents === 1 ? 'intención' : 'intenciones'} (${formatMoney(d.intentsCents)})`
  return `${formatDay(d.day)}: ${d.menuDevices} devices vieron un menú, ${intents}`
}

// Una barra por día (devices que vieron algún menú) y un punto encima de los
// días con intención de pedido. Barras y puntos se distinguen por forma, no
// solo por tono, y el valor exacto sale al pasar el mouse por toda la columna,
// no solo por la barra. Sin eje Y: el pico va rotulado directo y el detalle
// está en la tabla de abajo.
export function DailyBars({ days }: Props) {
  if (days.every((d) => d.menuDevices === 0 && d.intents === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Nadie vio un menú en los últimos {days.length} días.
      </p>
    )
  }

  const max = Math.max(...days.map((d) => d.menuDevices), 1)
  const peakIndex = days.findIndex((d) => d.menuDevices === max)
  const totalIntents = days.reduce((sum, d) => sum + d.intents, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-2 rounded-t-sm bg-muted-foreground/50" aria-hidden />
          Devices que vieron un menú
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-foreground" aria-hidden />
          Día con intención de pedido
        </span>
      </div>

      <div
        role="img"
        aria-label={`Últimos ${days.length} días. Pico: ${max} devices el ${formatDay(days[peakIndex].day)}. ${totalIntents} intenciones en total. El detalle por día está en la tabla de abajo.`}
        className="flex h-44 items-end gap-0.5 border-b pt-10"
      >
        {days.map((d, i) => {
          const pct = (d.menuDevices / max) * 100
          // El rótulo del pico se ancla al borde más cercano para no salirse de
          // la tarjeta cuando el pico cae en los primeros o últimos días.
          const peakAlign =
            i < days.length / 3
              ? 'left-0'
              : i > (days.length * 2) / 3
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2'
          return (
            <div
              key={d.day}
              title={dayTitle(d)}
              className="group relative flex h-full flex-1 items-end justify-center"
            >
              {i === peakIndex && (
                <span
                  className={`absolute whitespace-nowrap text-xs font-medium tabular-nums ${peakAlign}`}
                  style={{ bottom: `calc(${pct}% + ${d.intents > 0 ? 18 : 4}px)` }}
                >
                  {max} · {formatDay(d.day)}
                </span>
              )}
              {d.intents > 0 && (
                <span
                  className="absolute size-2 rounded-full bg-foreground"
                  style={{ bottom: `calc(${pct}% + 4px)` }}
                  aria-hidden
                />
              )}
              <div
                className="w-full max-w-4 rounded-t-sm bg-muted-foreground/50 group-hover:bg-muted-foreground"
                style={{ height: `${pct}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatDay(days[0].day)}</span>
        <span>hoy</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver por día</summary>
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {days
            .slice()
            .reverse()
            .map((d) => (
              <li key={d.day} className="flex justify-between gap-4">
                <span>{formatDay(d.day)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {d.menuDevices} vieron
                  {d.intents > 0 && ` · ${d.intents} int. · ${formatMoney(d.intentsCents)}`}
                </span>
              </li>
            ))}
        </ul>
      </details>
    </div>
  )
}
