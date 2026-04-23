import Image from 'next/image'
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
import type { BusinessWithCategory } from '../types'
import { ToggleActiveButton } from './toggle-active-button'

export function BusinessesTable({ businesses }: { businesses: BusinessWithCategory[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Foto</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-48 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                Sin negocios todavía.
              </TableCell>
            </TableRow>
          ) : (
            businesses.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  {b.photo_url ? (
                    <Image
                      src={b.photo_url}
                      alt={b.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-muted h-12 w-12 rounded-md" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-muted-foreground">{b.category?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{b.phone}</TableCell>
                <TableCell>
                  <Badge variant={b.is_active ? 'default' : 'secondary'}>
                    {b.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/businesses/${b.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Editar
                    </Link>
                    <ToggleActiveButton id={b.id} isActive={b.is_active} />
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
