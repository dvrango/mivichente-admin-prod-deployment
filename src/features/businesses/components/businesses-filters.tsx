import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CategoryOption } from '../types'

type Props = {
  search: string
  categoryId: string
  categories: CategoryOption[]
}

export function BusinessesFilters({ search, categoryId, categories }: Props) {
  return (
    <form className="flex flex-wrap gap-2">
      <Input name="q" defaultValue={search} placeholder="Buscar por nombre…" className="max-w-xs" />
      <select
        name="category"
        defaultValue={categoryId}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Filtrar
      </button>
      {search || categoryId ? (
        <Link href="/businesses" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Limpiar
        </Link>
      ) : null}
    </form>
  )
}
