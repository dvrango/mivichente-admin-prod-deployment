'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CategoryOption } from '@/features/businesses/types'

type Props = {
  categories: CategoryOption[]
  value?: string
  onValueChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
  /** Restringe las opciones a un solo tipo (ej. sincronizar con la categoría principal). */
  typeFilter?: CategoryOption['type']
}

export function CategorySelect({
  categories,
  value,
  onValueChange,
  disabled,
  placeholder = 'Selecciona una categoría',
  typeFilter,
}: Props) {
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const term = search.trim().toLowerCase()
  function matches(c: CategoryOption) {
    if (c.name.toLowerCase().includes(term)) return true
    return c.aliases?.some((a) => a.toLowerCase().includes(term)) ?? false
  }
  const byType = {
    food: categories.filter((c) => c.type === 'food'),
    business: categories.filter((c) => c.type === 'business'),
  }
  const filtered = {
    food: typeFilter && typeFilter !== 'food' ? [] : byType.food.filter(matches),
    business: typeFilter && typeFilter !== 'business' ? [] : byType.business.filter(matches),
  }
  const hasResults = filtered.food.length > 0 || filtered.business.length > 0

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onValueChange(v ?? '')}
      disabled={disabled}
      onOpenChangeComplete={(open) => {
        if (open) searchInputRef.current?.focus()
        else setSearch('')
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {categories.find((c) => c.id === value)?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <div className="sticky top-0 z-10 bg-popover p-1">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Buscar categoría..."
            className="h-8"
          />
        </div>
        {filtered.food.length > 0 && (
          <SelectGroup>
            <SelectLabel>Comida y bebida</SelectLabel>
            {filtered.food.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {filtered.business.length > 0 && (
          <SelectGroup>
            <SelectLabel>Comercios y servicios</SelectLabel>
            {filtered.business.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {!hasResults && (
          <p className="text-muted-foreground p-2 text-sm">
            Sin resultados para &quot;{search}&quot;
          </p>
        )}
      </SelectContent>
    </Select>
  )
}
