'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { REPORT_REASONS, REASON_LABELS, type ReportReason } from '../schema'

export function ReportsReasonFilter({ current }: { current: ReportReason | undefined }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/reports"
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          !current
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
      >
        Todos
      </Link>
      {REPORT_REASONS.map((r) => (
        <Link
          key={r}
          href={`/reports?reason=${r}`}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            current === r
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {REASON_LABELS[r]}
        </Link>
      ))}
    </div>
  )
}
