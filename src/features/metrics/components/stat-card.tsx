import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkline } from './sparkline'

type Props = {
  label: string
  value: string
  context?: ReactNode
  trend?: string
  series?: number[]
}

export function StatCard({ label, value, context, trend, series }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
          {trend && <div className="mt-1 text-sm text-muted-foreground">{trend}</div>}
          {context && <div className="mt-1 text-sm text-muted-foreground">{context}</div>}
        </div>
        {series && series.length > 1 && (
          <div className="shrink-0">
            <Sparkline values={series} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
