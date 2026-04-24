'use client'

import { FilterSegment } from '@/components/shared/filters'

export function CategoriesFilters() {
  return (
    <FilterSegment
      paramKey="type"
      options={[
        { value: null, label: 'Todas' },
        { value: 'food', label: 'Comida' },
        { value: 'business', label: 'Negocios' },
      ]}
    />
  )
}
