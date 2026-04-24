'use client'

import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useFilters } from './use-filters'

type Option = { value: string; label: string }

type Props = {
  paramKey: string
  options: Option[]
  placeholder?: string
}

export function FilterSelect({ paramKey, options, placeholder = 'Todos' }: Props) {
  const filters = useFilters()
  const current = filters.get(paramKey) ?? ''
  const currentLabel = options.find((o) => o.value === current)?.label

  return (
    <Select
      value={current}
      onValueChange={(v) => filters.set(paramKey, v || null)}
      disabled={filters.isPending}
    >
      <SelectTrigger>
        <span
          className={cn('flex flex-1 text-left text-sm', !currentLabel && 'text-muted-foreground')}
        >
          {currentLabel ?? placeholder}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
