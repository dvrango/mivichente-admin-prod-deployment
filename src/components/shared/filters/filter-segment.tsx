'use client'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFilters } from './use-filters'

type Option = { value: string | null; label: string }

type Props = {
  paramKey: string
  options: Option[]
}

export function FilterSegment({ paramKey, options }: Props) {
  const filters = useFilters()
  const current = filters.get(paramKey)

  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const isActive = o.value === null ? current === null : current === o.value
        return (
          <button
            key={o.value ?? '__all__'}
            onClick={() => filters.set(paramKey, o.value)}
            disabled={filters.isPending}
            className={cn(
              buttonVariants({ variant: isActive ? 'default' : 'outline', size: 'sm' }),
              'cursor-pointer',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
