'use client'

import { FilterReset, FilterSearch, FilterSegment, FilterSelect } from '@/components/shared/filters'
import { MUNICIPIOS } from '../schema'
import type { CategoryOption } from '../types'

type Props = { categories: CategoryOption[]; showMunicipio?: boolean }

export function BusinessesFilters({ categories, showMunicipio = false }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterSearch paramKey="q" placeholder="Buscar por nombre…" className="max-w-xs" />
      <FilterSelect
        paramKey="category"
        placeholder="Todas las categorías"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      {showMunicipio && (
        <FilterSelect
          paramKey="municipio"
          placeholder="Todos los municipios"
          options={MUNICIPIOS.map((m) => ({ value: m, label: m }))}
        />
      )}
      <FilterSegment
        paramKey="status"
        options={[
          { value: null, label: 'Todos' },
          { value: 'active', label: 'Activos' },
          { value: 'inactive', label: 'Inactivos' },
        ]}
      />
      <FilterReset keys={['q', 'category', 'municipio', 'status']} />
    </div>
  )
}
