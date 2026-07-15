'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDateShort } from '@/lib/date'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DATA_SOURCE_LABELS, type DataSource } from '../schema'
import type { BusinessWithCategory, CategoryOption } from '../types'
import { BusinessRowActions } from './business-row-actions'
import { BusinessesBulkBar } from './businesses-bulk-bar'

export function BusinessesTable({
  businesses,
  categories,
  canDelete = false,
  returnTo,
  reviewerMunicipio,
}: {
  businesses: BusinessWithCategory[]
  categories: CategoryOption[]
  canDelete?: boolean
  returnTo?: string
  // Reviewer viendo negocios de otro municipio (RLS ampliado en la lista):
  // solo puede ver, no accionar. undefined para admin (sin restricción).
  reviewerMunicipio?: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Al cambiar de página/filtros la lista llega con otros ids; podamos la selección
  // a los que siguen presentes para no arrastrar ids fuera de pantalla.
  const pageIds = businesses.map((b) => b.id)
  const selectedOnPage = pageIds.filter((id) => selected.has(id))
  const allChecked = pageIds.length > 0 && selectedOnPage.length === pageIds.length
  const someChecked = selectedOnPage.length > 0 && !allChecked

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of pageIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const selectedBusinesses = businesses.filter((b) => selected.has(b.id))

  return (
    <div className="space-y-3">
      {selectedBusinesses.length > 0 && (
        <BusinessesBulkBar
          selected={selectedBusinesses}
          categories={categories}
          canDelete={canDelete}
          onDone={() => setSelected(new Set())}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Seleccionar todos"
                  checked={allChecked}
                  indeterminate={someChecked}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
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
              <TableHead>Envío</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Actualizado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-muted-foreground py-8 text-center">
                  Sin negocios todavía.
                </TableCell>
              </TableRow>
            ) : (
              businesses.map((b) => (
                <TableRow key={b.id} data-state={selected.has(b.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Seleccionar ${b.name}`}
                      checked={selected.has(b.id)}
                      onCheckedChange={(checked) => toggle(b.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <BusinessRowActions
                      id={b.id}
                      isActive={b.is_active}
                      isVerified={b.is_verified}
                      isFeatured={b.is_featured}
                      canDelete={canDelete}
                      readOnly={!!reviewerMunicipio && b.municipio !== reviewerMunicipio}
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
                    <Link
                      href={`/businesses/${b.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                      className="hover:underline"
                    >
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
                    {b.has_delivery ? (
                      <Badge className="bg-purple-500 text-white hover:bg-purple-600">Envío</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {DATA_SOURCE_LABELS[b.data_source as DataSource]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {b.updated_by_profile?.email ? (
                      <div className="flex flex-col">
                        <span
                          className="text-foreground max-w-40 truncate"
                          title={b.updated_by_profile.email}
                        >
                          {b.updated_by_profile.email}
                        </span>
                        <span>{formatDateShort(b.updated_at)}</span>
                      </div>
                    ) : (
                      '—'
                    )}
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
