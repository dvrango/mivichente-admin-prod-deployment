'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useFilters } from './use-filters'

type Props = {
  paramKey?: string
  placeholder?: string
  className?: string
}

export function FilterSearch({ paramKey = 'q', placeholder = 'Buscar…', className }: Props) {
  const filters = useFilters()
  const [value, setValue] = useState(filters.get(paramKey) ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      filters.set(paramKey, v.trim() || null)
    }, 400)
  }

  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={filters.isPending}
      className={className}
    />
  )
}
