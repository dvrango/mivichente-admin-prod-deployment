'use client'

import { useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { normalizeText } from '@/lib/normalize'
import type { CategoryFormState } from '../actions'
import type { CategoryTerm } from '../queries'
import { categoryFormSchema, type CategoryFormInput } from '../schema'
import type { CategoryType } from '../types'

type Props = {
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>
  submitLabel: string
  // Todas las categorías existentes, para avisar de duplicados por nombre o alias.
  existing?: CategoryTerm[]
  // Id de la categoría en edición: se excluye para no chocar consigo misma.
  currentId?: string
  defaults?: {
    name?: string
    icon?: string | null
    type?: CategoryType
    aliases?: string[] | null
  }
}

const TYPE_ITEMS = [
  { value: 'food', label: 'Comida' },
  { value: 'business', label: 'Negocios' },
]

const clientSchema = categoryFormSchema.omit({ aliases: true })
type ClientFormInput = Omit<CategoryFormInput, 'aliases'>

// De dónde salió el término en ESTE formulario y con qué colisiona en otra
// categoría existente.
type Conflict = {
  input: string
  from: 'name' | 'alias'
  matchedId: string
  matchedCategory: string
  matchedAs: 'name' | 'alias'
}

export function CategoryForm({ action, submitLabel, existing = [], currentId, defaults }: Props) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [aliases, setAliases] = useState<string[]>(defaults?.aliases ?? [])
  const [aliasInput, setAliasInput] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<ClientFormInput | null>(null)
  const aliasInputRef = useRef<HTMLInputElement>(null)

  // Índice normalizado término → categoría que lo usa. Los nombres ganan sobre
  // los aliases cuando el mismo término aparece en ambos.
  const termIndex = useMemo(() => {
    const index = new Map<string, { id: string; category: string; as: 'name' | 'alias' }>()
    for (const cat of existing) {
      if (cat.id === currentId) continue
      const nameKey = normalizeText(cat.name)
      if (nameKey) index.set(nameKey, { id: cat.id, category: cat.name, as: 'name' })
    }
    for (const cat of existing) {
      if (cat.id === currentId) continue
      for (const alias of cat.aliases) {
        const key = normalizeText(alias)
        if (key && !index.has(key)) index.set(key, { id: cat.id, category: cat.name, as: 'alias' })
      }
    }
    return index
  }, [existing, currentId])

  function addAlias(value: string) {
    const trimmed = value.trim()
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases((prev) => [...prev, trimmed])
    }
    setAliasInput('')
  }

  function removeAlias(alias: string) {
    setAliases((prev) => prev.filter((a) => a !== alias))
  }

  function onAliasKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addAlias(aliasInput)
    } else if (e.key === 'Backspace' && aliasInput === '' && aliases.length > 0) {
      setAliases((prev) => prev.slice(0, -1))
    }
  }

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      icon: defaults?.icon ?? '',
      type: (defaults?.type ?? 'food') as 'food' | 'business',
    },
  })

  const watchedName = useWatch({ control: form.control, name: 'name' })

  // Colisiones vivas: el nombre y cada alias contra el índice de categorías.
  const conflicts = useMemo<Conflict[]>(() => {
    const found: Conflict[] = []
    const nameKey = normalizeText(watchedName ?? '')
    const nameHit = nameKey ? termIndex.get(nameKey) : undefined
    if (nameHit) {
      found.push({
        input: watchedName.trim(),
        from: 'name',
        matchedId: nameHit.id,
        matchedCategory: nameHit.category,
        matchedAs: nameHit.as,
      })
    }
    for (const alias of aliases) {
      const hit = termIndex.get(normalizeText(alias))
      if (hit) {
        found.push({
          input: alias,
          from: 'alias',
          matchedId: hit.id,
          matchedCategory: hit.category,
          matchedAs: hit.as,
        })
      }
    }
    return found
  }, [watchedName, aliases, termIndex])

  function doSubmit(values: ClientFormInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('icon', values.icon ?? '')
    fd.set('type', values.type)
    fd.set('aliases', JSON.stringify(aliases))
    startTransition(async () => {
      const result = await action({ error: null }, fd)
      if (result?.error) setServerError(result.error)
    })
  }

  function onSubmit(values: ClientFormInput) {
    if (conflicts.length > 0) {
      setPendingValues(values)
      setConfirmOpen(true)
      return
    }
    doSubmit(values)
  }

  function confirmSubmit() {
    setConfirmOpen(false)
    if (pendingValues) doSubmit(pendingValues)
    setPendingValues(null)
  }

  function renderConflict(c: Conflict) {
    const origin = c.from === 'name' ? 'El nombre' : `El alias «${c.input}»`
    // El término colisiona por su forma normalizada (sin acentos/mayúsculas), así
    // que la búsqueda ya lo encuentra vía la categoría existente —sea por nombre
    // o por alias—. No sirve agregarlo como alias; conviene usar esa categoría.
    const matchedAs = c.matchedAs === 'name' ? 'el nombre de' : 'un alias de'
    const matchedLink = (
      <Link
        href={`/categories/${c.matchedId}`}
        className="font-medium underline underline-offset-2"
      >
        «{c.matchedCategory}»
      </Link>
    )
    return (
      <>
        {origin} ya coincide con {matchedAs} {matchedLink}, que ya cubre este término en la
        búsqueda. Usa esa categoría en vez de crear una nueva.
      </>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input disabled={isPending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icono (emoji o texto)</FormLabel>
              <FormControl>
                <Input placeholder="🍔" disabled={isPending} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                disabled={isPending}
                items={TYPE_ITEMS}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="food">Comida</SelectItem>
                  <SelectItem value="business">Negocios</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            Aliases <span className="text-muted-foreground font-normal">(sinónimos populares)</span>
          </label>
          <div
            className="border-input focus-within:ring-ring flex min-h-10 flex-wrap gap-1.5 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2"
            onClick={() => aliasInputRef.current?.focus()}
          >
            {aliases.map((alias) => (
              <span
                key={alias}
                className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
              >
                {alias}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAlias(alias)
                  }}
                  disabled={isPending}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              ref={aliasInputRef}
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={onAliasKeyDown}
              onBlur={() => addAlias(aliasInput)}
              disabled={isPending}
              placeholder={aliases.length === 0 ? 'Escribe y presiona Enter o coma…' : ''}
              className="min-w-32 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Términos como los busca la gente (singular/plural, regionalismos, anglicismos). Ayudan a
            que la búsqueda encuentre negocios de esta categoría.
          </p>
        </div>
        {conflicts.length > 0 ? (
          <div
            className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            role="alert"
          >
            <p className="font-medium">Puede que esta categoría ya exista</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {conflicts.map((c) => (
                <li key={`${c.from}:${c.input}`}>{renderConflict(c)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {serverError ? (
          <p className="text-destructive text-sm" role="alert">
            {serverError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Crear de todos modos?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya hay categorías que cubren estos términos en la búsqueda. Considera usarlas en vez
              de crear una nueva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
            {conflicts.map((c) => (
              <li key={`confirm:${c.from}:${c.input}`}>{renderConflict(c)}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Revisar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={confirmSubmit}>
              Crear de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}
