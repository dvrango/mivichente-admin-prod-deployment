'use client'

import { FilterReset, FilterSearch, FilterSegment } from '@/components/shared/filters'

export function CategoriesFilters() {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterSearch paramKey="q" placeholder="Buscar por nombre o alias…" className="max-w-xs" />
      <FilterSegment
        paramKey="type"
        options={[
          { value: null, label: 'Todas' },
          { value: 'food', label: 'Comida' },
          { value: 'business', label: 'Negocios' },
        ]}
      />
      <FilterReset keys={['q', 'type']} />
    </div>
  )
}
