'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Star, StarOff, Tag, Trash2, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CategorySelect } from '@/components/shared/category-select'
import { CATEGORY_TYPE_LABELS } from '@/features/categories/types'
import {
  bulkDeleteBusinesses,
  bulkSetActive,
  bulkSetFeatured,
  bulkSetPrimaryCategory,
  type BulkResult,
} from '../actions'
import type { BusinessWithCategory, CategoryOption } from '../types'

type Props = {
  selected: BusinessWithCategory[]
  categories: CategoryOption[]
  canDelete?: boolean
  onDone: () => void
}

// Acción del menú bulk que abre un diálogo. Las directas (activar, recomendar) no
// abren nada: se aplican al hacer clic. Ampliar aquí conforme se sumen diálogos.
type BulkDialog = 'category' | 'delete' | null

export function BusinessesBulkBar({ selected, categories, canDelete = false, onDone }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<BulkDialog>(null)
  const [targetId, setTargetId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const ids = useMemo(() => selected.map((b) => b.id), [selected])
  const target = categories.find((c) => c.id === targetId) ?? null

  // Un negocio es incompatible si su categoría primaria actual es de otro tipo
  // que la categoría destino. Sin categoría (type null) = compatible.
  const { compatible, incompatible } = useMemo(() => {
    const compatible: BusinessWithCategory[] = []
    const incompatible: BusinessWithCategory[] = []
    for (const b of selected) {
      const currentType = b.category?.type ?? null
      if (target && currentType && currentType !== target.type) incompatible.push(b)
      else compatible.push(b)
    }
    return { compatible, incompatible }
  }, [selected, target])

  function closeDialog() {
    setDialog(null)
    setTargetId('')
    setError(null)
  }

  // Corre una acción bulk; en éxito limpia selección y refresca. En error lo muestra.
  function run(fn: () => Promise<BulkResult>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) {
        setError(res.error)
        return
      }
      closeDialog()
      onDone()
      router.refresh()
    })
  }

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-3 rounded-md border p-3">
      <span className="text-sm font-medium">
        {selected.length} {selected.length === 1 ? 'seleccionado' : 'seleccionados'}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" variant="outline" disabled={pending}>
              Acciones
              <ChevronDown className="ml-1 size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => setDialog('category')}>
            <Tag className="mr-2 size-4" />
            Cambiar categoría
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => run(() => bulkSetActive(ids, true))}>
            Activar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => bulkSetActive(ids, false))}>
            Desactivar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => bulkSetFeatured(ids, true))}>
            <Star className="mr-2 size-4" />
            Marcar recomendado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => bulkSetFeatured(ids, false))}>
            <StarOff className="mr-2 size-4" />
            Quitar recomendado
          </DropdownMenuItem>

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog('delete')}>
                <Trash2 className="mr-2 size-4" />
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={onDone} disabled={pending} className="ml-auto">
        <X className="mr-1 size-4" />
        Limpiar selección
      </Button>

      {/* Cambiar categoría: picker + preview de mismatch por tipo. */}
      <AlertDialog open={dialog === 'category'} onOpenChange={(o) => !o && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar categoría</AlertDialogTitle>
            <AlertDialogDescription>
              Nueva categoría principal para {selected.length}{' '}
              {selected.length === 1 ? 'negocio' : 'negocios'}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <CategorySelect
              categories={categories}
              value={targetId}
              onValueChange={setTargetId}
              disabled={pending}
              placeholder="Selecciona categoría…"
            />

            {target && incompatible.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {compatible.length} {compatible.length === 1 ? 'coincide' : 'coinciden'} con el tipo{' '}
                <strong>{CATEGORY_TYPE_LABELS[target.type]}</strong>. {incompatible.length}{' '}
                {incompatible.length === 1 ? 'es de otro tipo' : 'son de otro tipo'}:{' '}
                {incompatible.map((b) => b.name).join(', ')}.
              </p>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            {!target || incompatible.length === 0 ? (
              <Button
                onClick={() =>
                  run(() =>
                    bulkSetPrimaryCategory(
                      compatible.map((b) => b.id),
                      targetId,
                    ),
                  )
                }
                disabled={!target || pending}
              >
                Aplicar
              </Button>
            ) : (
              <>
                <Button
                  onClick={() =>
                    run(() =>
                      bulkSetPrimaryCategory(
                        compatible.map((b) => b.id),
                        targetId,
                      ),
                    )
                  }
                  disabled={pending || compatible.length === 0}
                >
                  Solo los {compatible.length} compatibles
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => run(() => bulkSetPrimaryCategory(ids, targetId))}
                  disabled={pending}
                >
                  Convertir los {selected.length}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar: destructivo, admin-only, borra también las fotos. */}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(o) => !o && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {selected.length} {selected.length === 1 ? 'negocio' : 'negocios'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se borrarán los negocios seleccionados y sus fotos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                run(() => bulkDeleteBusinesses(ids))
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
