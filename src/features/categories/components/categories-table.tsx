import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Category } from '../types'
import { CATEGORY_TYPE_LABELS } from '../types'
import { ToggleActiveButton } from './toggle-active-button'

export function CategoriesTable({ categories }: { categories: Category[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Icono</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Aliases</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-48 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                Sin categorías todavía.
              </TableCell>
            </TableRow>
          ) : (
            categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="text-xl">{cat.icon ?? '—'}</TableCell>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>
                  {cat.aliases && cat.aliases.length > 0 ? (
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {cat.aliases.map((alias) => (
                        <Badge key={alias} variant="secondary" className="font-normal">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
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
  )
}
