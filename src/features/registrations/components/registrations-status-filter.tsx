'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { REGISTRATION_STATUSES, STATUS_LABELS, type RegistrationStatus } from '../schema'

export function RegistrationsStatusFilter({ current }: { current: RegistrationStatus }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {REGISTRATION_STATUSES.map((s) => (
        <Link
          key={s}
          href={`/registrations?status=${s}`}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            current === s
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {STATUS_LABELS[s]}
        </Link>
      ))}
    </div>
  )
}
