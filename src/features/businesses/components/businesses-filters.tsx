'use client'

import { CategorySelect } from '@/components/shared/category-select'
import { FilterReset, FilterSearch, FilterSelect } from '@/components/shared/filters'
import { useFilters } from '@/components/shared/filters/use-filters'
import { MUNICIPIOS } from '../schema'
import type { CategoryOption } from '../types'

type Props = { categories: CategoryOption[]; showMunicipio?: boolean }

// Todos los filtros van como dropdown y no como segmento de botones: con 6
// dimensiones (nombre, categoría, municipio, estado, revisión, menú) los
// segmentos ocupaban 9 botones sueltos en dos filas y cada filtro nuevo
// empeoraba el desborde. El trigger muestra el valor activo, así que se sigue
// viendo qué está aplicado sin abrirlo.
export function BusinessesFilters({ categories, showMunicipio = false }: Props) {
  const filters = useFilters()

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <FilterSelect
        paramKey="status"
        placeholder="Estado: todos"
        options={[
          { value: 'active', label: 'Activos' },
          { value: 'inactive', label: 'Inactivos' },
        ]}
      />
      <FilterSelect
        paramKey="review"
        placeholder="Revisión: todos"
        options={[
          { value: 'pending', label: 'Sin revisar' },
          { value: 'reviewed', label: 'Revisados' },
        ]}
      />
      {/* Sólo aplica a negocios de comida: "con"/"sin" ya excluyen al resto. */}
      <FilterSelect
        paramKey="menu"
        placeholder="Menú: todos"
        options={[
          { value: 'with', label: 'Con menú' },
          { value: 'without', label: 'Sin menú' },
        ]}
      />
      <FilterReset keys={['q', 'category', 'municipio', 'status', 'review', 'verified', 'menu']} />
    </div>
  )
}
