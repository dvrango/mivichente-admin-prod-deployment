'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  User,
  UserX,
  X,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { uploadBusinessPhoto } from '@/lib/images/upload-business-photo'
import {
  createMenuItem,
  deleteMenuItem,
  moveMenuItem,
  setMenuItemVisibility,
  updateMenuItem,
} from '../actions'
import { menuItemCreateSchema, menuItemPatchSchema } from '../schema'
import type { MenuItem, MenuOptionGroup } from '../queries'
import {
  MenuItemForm,
  visibilityLabel,
  type MenuDraft,
  type MenuVisibility,
} from './menu-item-form'

// ─────────────────────────────────────────────────────────────────────────────
// Esta pantalla se usa DESDE EL CELULAR: el dueño y Sandra capturan menús
// parados en el negocio, no sentados frente a una laptop. Todo lo de aquí está
// pensado a 360px de ancho primero y ensanchado después, no al revés.
//
// El componente NO depende del chrome del dashboard (sidebar, topbar,
// breadcrumbs): recibe el negocio y si es de sólo lectura por props. El día que
// un dueño de negocio entre a editar su propio perfil se reusa tal cual y sólo
// cambia el envoltorio. Eso NO es construir el portal de dueños — sigue vigente
// la decisión que lo pospone; es no cerrarse la puerta.
//
// Nada de la interfaz usa nombres de columnas ni jerga. Y la palabra es
// PERFIL, no "ficha": es la que usa el equipo hablando, y era la que faltaba
// aquí — `schema.ts` ya decía "perfil" y la UI se había quedado atrás.
// ─────────────────────────────────────────────────────────────────────────────

/** Pseudo-sección para los ítems sin sección: 163 de 246 en prod están así. */
const SIN_SECCION = '\u0000sin-seccion'

type ItemState = { status: 'saving' | 'saved' | 'error'; message?: string }

/** Búsqueda tolerante a acentos y mayúsculas: nadie teclea "cóctel" con acento. */
function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
}

function priceToInput(price: number | null): string {
  return price === null ? '' : String(price)
}

function formatPrice(price: number | null): string {
  if (price === null) return 'Sin precio'
  return price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

/**
 * Con tamaños, `price` es el más barato de ellos y decir "$90" a secas es
 * justo el engaño que esta pantalla vino a quitar: alguien lee el precio de la
 * chica creyendo que es el de la pizza.
 */
function formatItemPrice(item: Pick<MenuItem, 'price' | 'variants'>): string {
  const base = formatPrice(item.price)
  return item.variants.length > 0 && item.price !== null ? `desde ${base}` : base
}

/**
 * Un grupo de opciones en una línea, para la vista de sólo lectura.
 *
 * Traduce las columnas al lenguaje del formulario — `min_select >= 1` es
 * "obligatorio", `max_select` null es "las que quiera" — porque quien lee esto
 * es la misma persona que captura, sólo que sin permiso de editar este negocio.
 */
function describeGroup(group: MenuOptionGroup): string {
  const cuantas =
    group.max_select === null
      ? 'las que quiera'
      : group.max_select === 1
        ? 'una'
        : `hasta ${group.max_select}`
  const regla = `${group.min_select >= 1 ? 'Obligatorio' : 'Opcional'}, ${cuantas}`
  if (group.options.length === 0) return `${regla} · sin opciones capturadas`
  const opciones = group.options
    .map((o) => (o.price_delta > 0 ? `${o.name} +${formatPrice(o.price_delta)}` : o.name))
    .join(', ')
  return `${regla} · ${opciones}`
}

/** Los dos booleans de la fila -> la opción que muestra el formulario. */
function toVisibility(item: Pick<MenuItem, 'is_published' | 'show_in_profile'>): MenuVisibility {
  if (!item.is_published) return 'oculto'
  return item.show_in_profile ? 'ambos' : 'solo_qr'
}

/**
 * La opción elegida -> los dos booleans que espera el server.
 *
 * En 'oculto' se CONSERVA `show_in_profile` en vez de apagarlo: es lo que hacía
 * la UI vieja (deshabilitaba el botón del perfil en lugar de escribirlo), así
 * que volver a publicar un ítem recupera la intención previa en vez de meterlo
 * al perfil porque sí.
 */
function fromVisibility(
  visibility: MenuVisibility,
  currentShowInProfile: boolean,
): { is_published: boolean; show_in_profile: boolean } {
  if (visibility === 'oculto') {
    return { is_published: false, show_in_profile: currentShowInProfile }
  }
  return { is_published: true, show_in_profile: visibility === 'ambos' }
}

export function MenuEditor({
  businessId,
  businessName,
  /** `businesses.services_label`. Sólo se LEE: sus escritores siguen siendo el
   *  form del negocio y modo campo. */
  servicesLabel,
  initialItems,
  readOnly,
}: {
  businessId: string
  businessName: string
  servicesLabel: string | null
  initialItems: MenuItem[]
  readOnly: boolean
}) {
  const isMenu = norm(servicesLabel ?? '').startsWith('men')
  const word = isMenu ? 'platillo' : 'servicio'
  const words = isMenu ? 'platillos' : 'servicios'

  const [items, setItems] = useState<MenuItem[]>(initialItems)
  const [query, setQuery] = useState('')
  const [sectionFilter, setSectionFilter] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [createState, setCreateState] = useState<ItemState | null>(null)
  const [state, setState] = useState<Record<string, ItemState>>({})
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // Capturar 8 platillos seguidos de "Bebidas" no debe pedir la sección 8 veces:
  // el alta arranca con la última sección usada (o con la que se está filtrando).
  const [lastSection, setLastSection] = useState('')

  const sections = useMemo(() => {
    const seen: string[] = []
    for (const item of items) {
      const s = (item.section ?? '').trim()
      if (s && !seen.includes(s)) seen.push(s)
    }
    return seen
  }, [items])

  const groups = useMemo(() => {
    const rows: { key: string; label: string; total: number; inProfile: number }[] = []
    const push = (key: string, label: string, item: MenuItem) => {
      let row = rows.find((r) => r.key === key)
      if (!row) {
        row = { key, label, total: 0, inProfile: 0 }
        rows.push(row)
      }
      row.total += 1
      if (item.show_in_profile) row.inProfile += 1
    }
    for (const item of items) {
      const s = (item.section ?? '').trim()
      if (s) push(s, s, item)
    }
    for (const item of items) {
      if (!(item.section ?? '').trim()) push(SIN_SECCION, 'Sin sección', item)
    }
    return rows
  }, [items])

  // Se busca por PALABRAS SUELTAS, todas presentes, no por la cadena completa:
  // buscar "cocteles 4" tiene que encontrar "Cócteles y Ceviches 4". Con
  // `includes` de la cadena entera daba cero resultados, que en un menú de 83 se
  // lee como "no existe" y manda al usuario a scrollear — justo lo que esta
  // pantalla viene a evitar.
  const terms = useMemo(() => norm(query).split(/\s+/).filter(Boolean), [query])
  const visible = useMemo(() => {
    return items.filter((item) => {
      const s = (item.section ?? '').trim()
      if (sectionFilter !== null) {
        if (sectionFilter === SIN_SECCION ? s !== '' : s !== sectionFilter) return false
      }
      if (terms.length === 0) return true
      const haystack = norm(`${item.name} ${s} ${item.description ?? ''}`)
      return terms.every((term) => haystack.includes(term))
    })
  }, [items, terms, sectionFilter])

  // Reordenar sobre una lista filtrada mentiría: `moveMenuItem` intercambia con
  // el vecino REAL, que puede estar escondido por el filtro. Con filtro puesto
  // las flechas no se ofrecen, y se dice por qué.
  const canReorder = terms.length === 0 && sectionFilter === null
  const activeGroup = sectionFilter === null ? null : groups.find((g) => g.key === sectionFilter)

  function markItem(id: string, next: ItemState | null) {
    setState((prev) => {
      const copy = { ...prev }
      if (next === null) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  /**
   * Sube la foto SÓLO si el resto del ítem ya pasó validación. Si se subiera
   * antes, un nombre vacío dejaría el archivo colgado en el bucket: las actions
   * limpian la foto cuando falla la ESCRITURA, no cuando falla el parseo.
   *
   * La UI nunca limpia el bucket después de un guardado fallido — eso ya lo hace
   * la action, y hacerlo dos veces borra dos veces.
   */
  async function resolvePhoto(
    draft: MenuDraft,
  ): Promise<{ url?: string | null; error?: string; touched: boolean }> {
    if (draft.photo.kind === 'keep') return { touched: false }
    if (draft.photo.kind === 'remove') return { url: null, touched: true }
    const uploaded = await uploadBusinessPhoto(draft.photo.file, businessId)
    if (uploaded.error || !uploaded.url) {
      return { error: uploaded.error ?? 'No se pudo subir la foto.', touched: true }
    }
    return { url: uploaded.url, touched: true }
  }

  async function handleCreate(draft: MenuDraft) {
    const base = {
      name: draft.name,
      price: draft.price,
      section: draft.section,
      description: draft.description,
      // Un ítem nuevo no tiene valor previo que conservar, así que el 'oculto'
      // de un alta arranca con el perfil en sí.
      ...fromVisibility(draft.visibility, true),
      variants: draft.variants,
      option_groups: draft.optionGroups,
    }
    const parsed = menuItemCreateSchema.safeParse(base)
    if (!parsed.success) {
      setCreateState({ status: 'error', message: parsed.error.issues[0]?.message })
      return
    }

    setCreateState({ status: 'saving' })
    const photo = await resolvePhoto(draft)
    if (photo.error) {
      setCreateState({ status: 'error', message: photo.error })
      return
    }

    const payload = photo.touched ? { ...base, image_url: photo.url ?? null } : base
    const result = await createMenuItem(businessId, payload)
    if (result.error || !result.item) {
      setCreateState({ status: 'error', message: result.error ?? 'No se pudo guardar.' })
      return
    }

    // Se repinta desde lo que DEVOLVIÓ la action, no desde el borrador: el
    // server canonicaliza la sección ("   bEbIdAs  " se guarda como "Bebidas" si
    // esa sección ya existe) y la ruta de esta pantalla no se revalida.
    const item = result.item
    setItems((prev) => [...prev, item])
    setLastSection(item.section ?? '')
    setCreateState(null)
    setAdding(false)
    markItem(item.id, { status: 'saved' })
  }

  async function handleUpdate(item: MenuItem, draft: MenuDraft) {
    const base = {
      name: draft.name,
      price: draft.price,
      section: draft.section,
      description: draft.description,
      ...fromVisibility(draft.visibility, item.show_in_profile),
      // Siempre presente en el patch: el form manda la lista completa, así que
      // omitirla sólo serviría para no poder vaciarla nunca. Vale igual para los
      // grupos de opciones, que tienen el mismo contrato de tres estados.
      variants: draft.variants,
      option_groups: draft.optionGroups,
    }
    const parsed = menuItemPatchSchema.safeParse(base)
    if (!parsed.success) {
      markItem(item.id, { status: 'error', message: parsed.error.issues[0]?.message })
      return
    }

    markItem(item.id, { status: 'saving' })
    const photo = await resolvePhoto(draft)
    if (photo.error) {
      markItem(item.id, { status: 'error', message: photo.error })
      return
    }

    // `image_url` se agrega SÓLO si la foto cambió. Mandarlo como `undefined`
    // no es lo mismo que no mandarlo: la clave presente significa "cámbiala",
    // y con undefined el ítem se quedaría sin foto sin que nadie lo pidiera.
    const payload = photo.touched ? { ...base, image_url: photo.url ?? null } : base
    const result = await updateMenuItem(businessId, item.id, payload)
    if (result.error || !result.item) {
      markItem(item.id, { status: 'error', message: result.error ?? 'No se pudo guardar.' })
      return
    }

    const saved = result.item
    setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)))
    markItem(saved.id, { status: 'saved' })
    setOpenId(null)
  }

  async function handleMove(item: MenuItem, direction: 'up' | 'down') {
    const index = items.findIndex((i) => i.id === item.id)
    const target = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || target < 0 || target >= items.length) return

    markItem(item.id, { status: 'saving' })
    const result = await moveMenuItem(businessId, item.id, direction)
    if (result.error) {
      markItem(item.id, { status: 'error', message: result.error })
      return
    }
    setItems((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    markItem(item.id, { status: 'saved' })
  }

  async function handleDelete(item: MenuItem) {
    markItem(item.id, { status: 'saving' })
    const result = await deleteMenuItem(businessId, item.id)
    setConfirmDelete(null)
    if (result.error) {
      markItem(item.id, { status: 'error', message: result.error })
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    markItem(item.id, null)
    setOpenId(null)
  }

  /**
   * Saca (o mete) una sección ENTERA del perfil del negocio.
   *
   * Con 83 platillos en 13 secciones, dejar "Bar" y "Bebidas" fuera del perfil
   * ítem por ítem son ~20 toques. Se recorre sólo lo que realmente cambia y se
   * para en el primer error para no dejar media sección en un estado y media en
   * otro sin decirlo.
   */
  async function handleBulkProfile(groupKey: string, next: boolean) {
    const affected = items.filter((item) => {
      const s = (item.section ?? '').trim()
      const inGroup = groupKey === SIN_SECCION ? s === '' : s === groupKey
      return inGroup && item.show_in_profile !== next
    })
    if (affected.length === 0) return

    setBulkRunning(true)
    setBulkError(null)
    for (const item of affected) {
      const result = await setMenuItemVisibility(businessId, item.id, { show_in_profile: next })
      if (result.error) {
        setBulkError(result.error)
        break
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, show_in_profile: next } : i)))
    }
    setBulkRunning(false)
  }

  return (
    <div className="space-y-3">
      {readOnly && (
        <p className="bg-muted text-muted-foreground rounded-lg border p-3 text-sm">
          Estás viendo el {isMenu ? 'menú' : 'listado'} de un negocio de otro municipio. Puedes
          consultarlo, pero no cambiarlo.
        </p>
      )}

      {/* Barra pegada arriba: buscar es LO PRIMERO que se hace en un menú de 83.
          Corregir un precio no debe requerir scrollear buscando el platillo.

          El `::before` extiende el fondo hacia el padding del contenedor que
          scrollea. Sin él quedaba una franja de 1rem arriba y a los lados por
          donde se veía pasar el texto de la lista por detrás de la barra —
          medido a 360px: la barra arranca en y=114 y el scrollport en y=98. */}
      <div className="bg-background sticky top-0 z-10 space-y-2 py-2 before:absolute before:-top-4 before:-right-4 before:bottom-0 before:-left-4 before:-z-10 before:bg-[inherit] before:content-[''] lg:before:-top-6 lg:before:-right-6 lg:before:-left-6">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="h-11 pl-9 md:h-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${word} por nombre…`}
            aria-label={`Buscar ${word}`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="text-muted-foreground absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {groups.length > 0 && (
          // Scroll horizontal PROPIO de la fila de chips: 13 secciones no caben
          // a 360px, y la alternativa (envolver) empuja la lista fuera de vista.
          // La página nunca scrollea de lado; este contenedor sí.
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Chip active={sectionFilter === null} onClick={() => setSectionFilter(null)}>
              Todas ({items.length})
            </Chip>
            {groups.map((group) => (
              <Chip
                key={group.key}
                active={sectionFilter === group.key}
                onClick={() => setSectionFilter(sectionFilter === group.key ? null : group.key)}
              >
                {group.inProfile === 0 && <UserX className="size-3.5 opacity-70" />}
                {group.label} ({group.total})
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Acción por sección completa. Aparece al elegir una sección: es donde el
          usuario ya está mirando ese grupo, y evita un panel aparte. */}
      {activeGroup && !readOnly && (
        <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
          <p className="text-sm">
            <span className="font-medium">{activeGroup.label}</span>{' '}
            <span className="text-muted-foreground">
              · {activeGroup.total} {activeGroup.total === 1 ? word : words} ·{' '}
              {activeGroup.inProfile === 0
                ? 'ninguno sale en el perfil'
                : activeGroup.inProfile === activeGroup.total
                  ? 'todos salen en el perfil'
                  : `${activeGroup.inProfile} de ${activeGroup.total} salen en el perfil`}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full md:h-8 md:w-auto"
            disabled={bulkRunning}
            onClick={() => handleBulkProfile(activeGroup.key, activeGroup.inProfile === 0)}
          >
            {bulkRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : activeGroup.inProfile === 0 ? (
              <User className="size-4" />
            ) : (
              <UserX className="size-4" />
            )}
            {activeGroup.inProfile === 0
              ? 'Poner toda la sección en el perfil'
              : 'Sacar toda la sección del perfil'}
          </Button>
          <p className="text-muted-foreground text-xs">
            El menú del QR (el de la mesa) siempre los muestra. Esto sólo cambia el perfil del
            negocio en la app.
          </p>
          {bulkError && <p className="text-destructive text-sm">{bulkError}</p>}
        </div>
      )}

      {!readOnly && !adding && (
        <Button
          type="button"
          className="h-11 w-full md:h-9 md:w-auto"
          onClick={() => {
            setCreateState(null)
            setAdding(true)
            setOpenId(null)
          }}
        >
          <Plus className="size-4" />
          Agregar {word}
        </Button>
      )}

      {adding && (
        <div className="border-primary/40 rounded-lg border-2 p-3">
          <p className="mb-2 text-sm font-medium">
            Nuevo {word} de {businessName}
          </p>
          <MenuItemForm
            mode="nuevo"
            word={word}
            isMenu={isMenu}
            sections={sections}
            // La sección arranca en la que se está filtrando, si no en la última
            // que se usó. Capturar una sección completa no la vuelve a pedir.
            initial={{
              name: '',
              price: '',
              variants: [],
              optionGroups: [],
              section:
                sectionFilter !== null && sectionFilter !== SIN_SECCION
                  ? sectionFilter
                  : lastSection,
              description: '',
              // Capturar es para publicar: un alta arranca visible en las dos
              // superficies y se restringe sólo si alguien lo pide.
              visibility: 'ambos',
              imageUrl: null,
            }}
            saving={createState?.status === 'saving'}
            error={createState?.status === 'error' ? (createState.message ?? null) : null}
            onSave={handleCreate}
            onCancel={() => {
              setAdding(false)
              setCreateState(null)
            }}
          />
        </div>
      )}

      {items.length === 0 && !adding && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Este negocio todavía no tiene {words} capturados.
        </p>
      )}

      {items.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {visible.length === items.length
            ? `${items.length} ${items.length === 1 ? word : words}`
            : `${visible.length} de ${items.length} ${words}`}
          {!canReorder && items.length > 1 && ' · quita el filtro y la búsqueda para reordenar'}
        </p>
      )}

      {items.length > 0 && visible.length === 0 && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Ningún {word} coincide con lo que buscaste.
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((item) => {
          const itemState = state[item.id]
          const open = openId === item.id
          const index = items.findIndex((i) => i.id === item.id)

          return (
            <li
              key={item.id}
              className={`rounded-lg border ${item.is_published ? '' : 'bg-muted/30'} ${
                itemState?.status === 'error' ? 'border-destructive/50' : ''
              }`}
            >
              {/* Fila cerrada: nada que se teclee, así que nada que aplastar. El
                  nombre trunca, el precio no envuelve, y el bloque entero es un
                  solo objetivo táctil. */}
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : item.id)
                  setAdding(false)
                }}
                aria-expanded={open}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt=""
                    width={48}
                    height={48}
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="bg-muted size-12 shrink-0 rounded-md" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${item.is_published ? '' : 'line-through'}`}>
                    {item.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">
                      {(item.section ?? '').trim() || 'Sin sección'}
                    </span>
                    {!item.is_published && <Tag tone="warn">Oculto</Tag>}
                    {item.is_published && !item.show_in_profile && (
                      <Tag tone="muted">Solo en el QR</Tag>
                    )}
                    {itemState?.status === 'saving' && (
                      <Tag tone="muted">
                        <Loader2 className="size-3 animate-spin" /> Guardando
                      </Tag>
                    )}
                    {itemState?.status === 'saved' && (
                      <Tag tone="ok">
                        <Check className="size-3" /> Guardado
                      </Tag>
                    )}
                    {itemState?.status === 'error' && (
                      <Tag tone="error">
                        <TriangleAlert className="size-3" /> No se guardó
                      </Tag>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatItemPrice(item)}
                </span>
                <ChevronDown
                  className={`text-muted-foreground size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {itemState?.status === 'error' && !open && (
                <p className="text-destructive px-3 pb-3 text-sm">{itemState.message}</p>
              )}

              {open && (
                <div className="space-y-3 border-t p-3">
                  {readOnly ? (
                    <dl className="space-y-2 text-sm">
                      <Row label="Precio">{formatItemPrice(item)}</Row>
                      {item.variants.length > 0 && (
                        <Row label="Tamaños">
                          {item.variants
                            .map((v) => `${v.name} ${formatPrice(v.price)}`)
                            .join(' · ')}
                        </Row>
                      )}
                      {/* Una fila por grupo, con el mismo lenguaje que lee quien
                          sí puede editar: "obligatorio", no "min_select 1". */}
                      {item.option_groups.map((group) => (
                        <Row key={group.id} label={group.name}>
                          {describeGroup(group)}
                        </Row>
                      ))}
                      <Row label="Sección">{(item.section ?? '').trim() || 'Sin sección'}</Row>
                      <Row label="Descripción">{item.description || '—'}</Row>
                      {/* Una sola fila, con el mismo texto que ve quien sí
                          puede editar: dos filas de Sí/No obligaban a cruzar
                          mentalmente los dos ejes para saber dónde sale. */}
                      <Row label="¿Quién lo ve?">{visibilityLabel(toVisibility(item))}</Row>
                    </dl>
                  ) : (
                    <>
                      <MenuItemForm
                        key={`${item.id}-${item.updated_at}`}
                        mode="editar"
                        word={word}
                        isMenu={isMenu}
                        sections={sections}
                        initial={{
                          name: item.name,
                          price: priceToInput(item.price),
                          variants: item.variants.map((v) => ({
                            id: v.id,
                            name: v.name,
                            price: priceToInput(v.price),
                          })),
                          // `min_select >= 1` es lo que la DB llama obligatorio;
                          // el formulario lo pregunta en español y `schema.ts`
                          // lo traduce de vuelta al guardar.
                          optionGroups: item.option_groups.map((g) => ({
                            id: g.id,
                            name: g.name,
                            required: g.min_select >= 1,
                            // La columna vuelve a ser la respuesta que el
                            // formulario sabe hacer: null = las que quiera,
                            // 1 = solo una, y cualquier otro número = hasta N.
                            maxMode:
                              g.max_select === null
                                ? 'todas'
                                : g.max_select === 1
                                  ? 'una'
                                  : 'hasta',
                            maxSelect: g.max_select === null ? '2' : String(g.max_select),
                            options: g.options.map((o) => ({
                              id: o.id,
                              name: o.name,
                              // 0 se muestra vacío: "sin costo" es el caso normal
                              // y un "0" tecleado en cada opción es ruido.
                              price_delta: o.price_delta === 0 ? '' : priceToInput(o.price_delta),
                            })),
                          })),
                          section: (item.section ?? '').trim(),
                          description: item.description ?? '',
                          visibility: toVisibility(item),
                          imageUrl: item.image_url,
                        }}
                        saving={itemState?.status === 'saving'}
                        error={itemState?.status === 'error' ? (itemState.message ?? null) : null}
                        onSave={(draft) => void handleUpdate(item, draft)}
                        onCancel={() => setOpenId(null)}
                      />

                      {/* La visibilidad ya vive DENTRO del formulario, como una
                          pregunta de tres respuestas. Acá había dos botones que
                          escribían al tocarse: dos modelos de guardado en la
                          misma tarjeta, y un label que decía el estado actual
                          pero se veía como acción. */}

                      {/* Tres botones en columnas iguales: reparten el ancho en
                          vez de reclamar píxeles fijos como los íconos sueltos
                          del editor viejo. */}
                      <div className={`grid gap-2 ${canReorder ? 'grid-cols-3' : 'grid-cols-1'}`}>
                        {canReorder && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 md:h-9"
                              disabled={index <= 0 || itemState?.status === 'saving'}
                              onClick={() => void handleMove(item, 'up')}
                            >
                              <ArrowUp className="size-4" />
                              Subir
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 md:h-9"
                              disabled={index >= items.length - 1 || itemState?.status === 'saving'}
                              onClick={() => void handleMove(item, 'down')}
                            >
                              <ArrowDown className="size-4" />
                              Bajar
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-11 md:h-9"
                          disabled={itemState?.status === 'saving'}
                          onClick={() => setConfirmDelete(item)}
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{confirmDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita del menú del QR y del perfil del negocio, junto con su foto. No se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirmDelete && void handleDelete(confirmDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
        active ? 'bg-primary text-primary-foreground border-transparent' : 'border-input'
      }`}
    >
      {children}
    </button>
  )
}

function Tag({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'error' | 'muted'
  children: React.ReactNode
}) {
  const tones = {
    ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
    muted: 'border-input text-muted-foreground',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground w-32 shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}
