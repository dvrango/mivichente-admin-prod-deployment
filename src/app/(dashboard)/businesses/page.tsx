import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BusinessWithCategory, Category } from '@/lib/types'
import { ToggleActiveButton } from './toggle-active-button'

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { q, category } = await searchParams
  const search = (q ?? '').trim()
  const categoryId = (category ?? '').trim()

  const supabase = await createClient()

  const [categoriesRes, businessesRes] = await Promise.all([
    supabase.from('categories').select('id, name, type').order('name'),
    (() => {
      let query = supabase
        .from('businesses')
        .select('*, category:categories(id, name, type)')
        .order('created_at', { ascending: false })
      if (search) query = query.ilike('name', `%${search}%`)
      if (categoryId) query = query.eq('category_id', categoryId)
      return query
    })(),
  ])

  const categories = (categoriesRes.data ?? []) as Pick<Category, 'id' | 'name' | 'type'>[]
  const businesses = (businessesRes.data ?? []) as BusinessWithCategory[]
  const error = businessesRes.error ?? categoriesRes.error

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Negocios</h1>
          <p className="text-muted-foreground text-sm">
            {businesses.length} {businesses.length === 1 ? 'negocio' : 'negocios'}
          </p>
        </div>
        <Link href="/businesses/new" className={buttonVariants()}>
          Nuevo negocio
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre…"
          className="max-w-xs"
        />
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

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          Error al cargar: {error.message}
        </p>
      ) : null}

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
    </div>
  )
}
