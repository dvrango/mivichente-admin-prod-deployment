import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DATA_SOURCE_LABELS, type DataSource } from '../schema'
import type { BusinessWithCategory } from '../types'
import { BusinessRowActions } from './business-row-actions'

export function BusinessesTable({ businesses }: { businesses: BusinessWithCategory[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
            <TableHead className="w-20">Foto</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Verificado</TableHead>
            <TableHead>Recomendado</TableHead>
            <TableHead>Origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                Sin negocios todavía.
              </TableCell>
            </TableRow>
          ) : (
            businesses.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <BusinessRowActions
                    id={b.id}
                    isActive={b.is_active}
                    isVerified={b.is_verified}
                    isFeatured={b.is_featured}
                  />
                </TableCell>
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
                <TableCell className="font-medium">
                  <Link href={`/businesses/${b.id}`} className="hover:underline">
                    {b.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{b.category?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{b.phone}</TableCell>
                <TableCell>
                  <Badge
                    variant={b.is_active ? 'default' : 'secondary'}
                    className={b.is_active ? 'bg-green-500 text-white hover:bg-green-600' : ''}
                  >
                    {b.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {b.is_verified ? (
                    <Badge className="bg-blue-500 text-white hover:bg-blue-600">Verificado</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {b.is_featured ? (
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                      Recomendado
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{DATA_SOURCE_LABELS[b.data_source as DataSource]}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
