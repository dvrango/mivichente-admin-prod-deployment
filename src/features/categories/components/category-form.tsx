'use client'

import { useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import type { CategoryFormState } from '../actions'
import { categoryFormSchema, type CategoryFormInput } from '../schema'
import type { CategoryType } from '../types'

type Props = {
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>
  submitLabel: string
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

export function CategoryForm({ action, submitLabel, defaults }: Props) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [aliases, setAliases] = useState<string[]>(defaults?.aliases ?? [])
  const [aliasInput, setAliasInput] = useState('')
  const aliasInputRef = useRef<HTMLInputElement>(null)

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

  function onSubmit(values: ClientFormInput) {
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
    </Form>
  )
}
