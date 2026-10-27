'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MISSING_REPORT_STATUSES, MISSING_STATUS_LABELS, type MissingReportStatus } from '../schema'

export function MissingReportsStatusFilter({ current }: { current: MissingReportStatus }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MISSING_REPORT_STATUSES.map((s) => (
        <Link
          key={s}
          href={`/missing-businesses?status=${s}`}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            current === s
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {MISSING_STATUS_LABELS[s]}
        </Link>
      ))}
    </div>
  )
}
