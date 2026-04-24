'use client'

import { buttonVariants } from '@/components/ui/button'
import { useFilters } from './use-filters'

type Props = {
  keys: string[]
  label?: string
}

export function FilterReset({ keys, label = 'Limpiar' }: Props) {
  const filters = useFilters()
  if (!filters.hasAny(keys)) return null

  return (
    <button
      onClick={() => filters.reset(keys)}
      disabled={filters.isPending}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      {label}
    </button>
  )
}
