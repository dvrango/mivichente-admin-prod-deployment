'use client'

import Image from 'next/image'
import { useState, useTransition, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/shared/phone-input'
import { normalizeMxPhone } from '@/lib/validation/phone'
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
import { Textarea } from '@/components/ui/textarea'
import type { BusinessFormState } from '../actions'
import { businessFormSchema, type BusinessFormInput } from '../schema'
import type { CategoryOption, WeeklyHours } from '../types'
import { BusinessHoursEditor } from './business-hours-editor'

type Props = {
  action: (prev: BusinessFormState, formData: FormData) => Promise<BusinessFormState>
  submitLabel: string
  categories: CategoryOption[]
  defaults?: {
    name?: string
    category_id?: string | null
    phone?: string
    phone_is_whatsapp?: boolean | null
    address?: string | null
    maps_url?: string | null
    photo_url?: string | null
    aliases?: string[] | null
  }
  defaultHours?: WeeklyHours
}

const clientSchema = businessFormSchema.omit({ aliases: true })
type ClientFormInput = Omit<BusinessFormInput, 'aliases'>

export function BusinessForm({ action, submitLabel, categories, defaults, defaultHours }: Props) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaults?.photo_url ?? null)
  const [aliases, setAliases] = useState<string[]>(defaults?.aliases ?? [])
  const [aliasInput, setAliasInput] = useState('')
  const [hours, setHours] = useState<WeeklyHours>(defaultHours ?? {})
  const [showHours, setShowHours] = useState(() => Object.keys(defaultHours ?? {}).length > 0)
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
      category_id: defaults?.category_id ?? '',
      phone: normalizeMxPhone(defaults?.phone),
      phone_is_whatsapp: defaults?.phone_is_whatsapp ?? false,
      address: defaults?.address ?? '',
      maps_url: defaults?.maps_url ?? '',
      photo: null,
    },
  })

  function onSubmit(values: ClientFormInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('category_id', values.category_id)
    fd.set('phone', values.phone)
    fd.set('phone_is_whatsapp', String(values.phone_is_whatsapp))
    fd.set('address', values.address ?? '')
    fd.set('maps_url', values.maps_url ?? '')
    fd.set('aliases', JSON.stringify(aliases))
    fd.set('hours', JSON.stringify(hours))
    if (values.photo) fd.set('photo', values.photo)
    startTransition(async () => {
      const result = await action({ error: null }, fd)
      if (result?.error) setServerError(result.error)
    })
  }

  const categoryItems = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
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
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v ?? '')}
                disabled={isPending}
                items={categoryItems}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl>
                <PhoneInput
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone_is_whatsapp"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                  id="phone_is_whatsapp"
                />
              </FormControl>
              <FormLabel htmlFor="phone_is_whatsapp" className="!mt-0 cursor-pointer">
                El teléfono tiene WhatsApp
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Textarea rows={2} disabled={isPending} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maps_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de Google Maps</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://maps.app.goo.gl/..."
                  disabled={isPending}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showHours ? (
          <BusinessHoursEditor
            value={hours}
            onChange={setHours}
            onRemove={() => setShowHours(false)}
            disabled={isPending}
          />
        ) : (
          <div>
            <p className="text-muted-foreground mb-2 text-sm font-medium">Horarios</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setShowHours(true)}
            >
              + Agregar horarios
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            Aliases <span className="text-muted-foreground font-normal">(nombres populares)</span>
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
            Nombres como los conoce la gente. Ayudan a que la búsqueda los encuentre.
          </p>
        </div>

        <FormField
          control={form.control}
          name="photo"
          render={({ field: { onChange, ref, name, onBlur, disabled } }) => (
            <FormItem>
              <FormLabel>Foto (JPG, PNG, WEBP — máx 5 MB)</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isPending || disabled}
                  name={name}
                  ref={ref}
                  onBlur={onBlur}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    onChange(file)
                    setPreviewUrl(file ? URL.createObjectURL(file) : (defaults?.photo_url ?? null))
                  }}
                />
              </FormControl>
              {previewUrl ? (
                <div className="mt-2">
                  <Image
                    src={previewUrl}
                    alt="Vista previa"
                    width={240}
                    height={160}
                    className="h-40 w-60 rounded-md border object-cover"
                    unoptimized
                  />
                </div>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

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
