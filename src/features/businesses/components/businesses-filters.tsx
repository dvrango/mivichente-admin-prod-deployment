'use client'

import { CategorySelect } from '@/components/shared/category-select'
import { FilterReset, FilterSearch, FilterSegment, FilterSelect } from '@/components/shared/filters'
import { useFilters } from '@/components/shared/filters/use-filters'
import { MUNICIPIOS } from '../schema'
import type { CategoryOption } from '../types'

type Props = { categories: CategoryOption[]; showMunicipio?: boolean }

export function BusinessesFilters({ categories, showMunicipio = false }: Props) {
  const filters = useFilters()

  return (
    <div className="flex flex-wrap gap-2">
      <FilterSearch paramKey="q" placeholder="Buscar por nombre…" className="max-w-xs" />
      <div className="w-56">
        <CategorySelect
          categories={categories}
          value={filters.get('category') ?? undefined}
          onValueChange={(v) => filters.set('category', v || null)}
          placeholder="Todas las categorías"
          disabled={filters.isPending}
        />
      </div>
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
      <FilterSegment
        paramKey="review"
        options={[
          { value: null, label: 'Revisión: todos' },
          { value: 'pending', label: 'Sin revisar' },
          { value: 'reviewed', label: 'Revisados' },
        ]}
      />
      <FilterReset keys={['q', 'category', 'municipio', 'status', 'review', 'verified']} />
    </div>
  )
}
