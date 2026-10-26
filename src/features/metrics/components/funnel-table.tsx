import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '../format'
import type { BusinessFunnel, FunnelCounts, OrderQrMetrics } from '../queries'

type Props = {
  rows: BusinessFunnel[]
  total: OrderQrMetrics['total']
  longDays: number
}

const STEPS: { key: keyof FunnelCounts; label: string }[] = [
  { key: 'viewed', label: 'Vieron el menú' },
  { key: 'added', label: 'Agregaron' },
  { key: 'checkout', label: 'Checkout' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'intents', label: 'Intenciones' },
]

// Cada celda lleva el número de esta semana y, debajo y apagado, el de la
// anterior: la comparación se lee sin cambiar de tabla.
function Cell({ current, previous }: { current: string; previous: string }) {
  return (
    <TableCell className="text-right align-top">
      <div className="tabular-nums">{current}</div>
      <div className="text-xs text-muted-foreground tabular-nums">antes {previous}</div>
    </TableCell>
  )
}

function Row({
  name,
  funnel,
}: {
  name: string
  funnel: Omit<BusinessFunnel, 'businessId' | 'businessName'>
}) {
  const { current, previous } = funnel
  return (
    <TableRow>
      <TableCell
        className="sticky left-0 z-10 max-w-36 truncate bg-card align-top font-medium sm:max-w-48"
        title={name}
      >
        {name}
      </TableCell>
      {STEPS.map(({ key }) => (
        <Cell key={key} current={String(current[key])} previous={String(previous[key])} />
      ))}
      <Cell
        current={formatMoney(current.intentsCents)}
        previous={formatMoney(previous.intentsCents)}
      />
      <TableCell className="text-right align-top">
        <div className="tabular-nums">{funnel.intentsLong}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatMoney(funnel.intentsCentsLong)}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function FunnelTable({ rows, total, longDays }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nadie ha visto un menú en las últimas dos semanas ni ha mandado un pedido en {longDays}{' '}
        días.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {/* Negocio queda fijo: en teléfono la tabla se desplaza de lado y sin
              él no se sabe de quién es cada número. */}
          <TableHead className="sticky left-0 z-10 bg-card">Negocio</TableHead>
          {STEPS.map(({ key, label }) => (
            <TableHead key={key} className="text-right">
              {label}
            </TableHead>
          ))}
          <TableHead className="text-right">Monto</TableHead>
          <TableHead className="text-right">Intenciones {longDays} días</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <Row key={row.businessId} name={row.businessName} funnel={row} />
        ))}
      </TableBody>
      <TableFooter>
        <Row name="Total" funnel={total} />
      </TableFooter>
    </Table>
  )
}
