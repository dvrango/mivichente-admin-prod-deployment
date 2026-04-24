'use client'

import { FilterReset, FilterSearch, FilterSelect } from '@/components/shared/filters'
import type { CategoryOption } from '../types'

type Props = { categories: CategoryOption[] }

export function BusinessesFilters({ categories }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterSearch paramKey="q" placeholder="Buscar por nombre…" className="max-w-xs" />
      <FilterSelect
        paramKey="category"
        placeholder="Todas las categorías"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      <FilterReset keys={['q', 'category']} />
    </div>
  )
}
