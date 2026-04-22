import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CATEGORY_TYPE_LABELS, type Category, type CategoryType } from '@/lib/types'
import { ToggleActiveButton } from './toggle-active-button'

const VALID_TYPES: readonly CategoryType[] = ['food', 'business']

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const filter = VALID_TYPES.includes(type as CategoryType) ? (type as CategoryType) : null

  const supabase = await createClient()
  let query = supabase.from('categories').select('*').order('created_at', { ascending: false })
  if (filter) query = query.eq('type', filter)

  const { data, error } = await query
  const categories = (data ?? []) as Category[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categorías</h1>
          <p className="text-muted-foreground text-sm">
            {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
          </p>
        </div>
        <Link href="/categories/new" className={buttonVariants()}>
          Nueva categoría
        </Link>
      </div>

      <div className="flex gap-2">
        <FilterLink label="Todas" href="/categories" active={filter === null} />
        <FilterLink label="Comida" href="/categories?type=food" active={filter === 'food'} />
        <FilterLink
          label="Negocios"
          href="/categories?type=business"
          active={filter === 'business'}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          Error al cargar: {error.message}
        </p>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Icono</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-48 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  Sin categorías todavía.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="text-xl">{cat.icon ?? '—'}</TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{CATEGORY_TYPE_LABELS[cat.type]}</TableCell>
                  <TableCell>
                    <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                      {cat.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/categories/${cat.id}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Editar
                      </Link>
                      <ToggleActiveButton id={cat.id} isActive={cat.is_active} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' })}
    >
      {label}
    </Link>
  )
}
