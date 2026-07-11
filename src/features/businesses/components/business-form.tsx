'use client'

import Image from 'next/image'
import { useEffect, useState, useTransition, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { CategorySelect } from '@/components/shared/category-select'
import { PhoneInput } from '@/components/shared/phone-input'
import { normalizeMxPhone } from '@/lib/validation/phone'
import { slugify } from '@/lib/slug'
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
import { businessFormSchema, MUNICIPIOS, type BusinessFormInput } from '../schema'
import type { CategoryOption, WeeklyHours } from '../types'
import { BusinessHoursEditor } from './business-hours-editor'

type Props = {
  action: (prev: BusinessFormState, formData: FormData) => Promise<BusinessFormState>
  submitLabel: string
  categories: CategoryOption[]
  // Reviewer: municipio fijo a su asignado (el RLS rechaza otros municipios).
  lockedMunicipio?: string
  // Negocio de otro municipio visto por un reviewer: se ve pero no se edita
  // (el RLS de UPDATE ya lo bloquea; esto evita que la UI prometa algo que
  // el submit va a rechazar).
  readOnly?: boolean
  defaults?: {
    name?: string
    slug?: string | null
    primary_category_id?: string | null
    secondary_category_ids?: string[] | null
    phone?: string
    phone_is_whatsapp?: boolean | null
    address?: string | null
    maps_url?: string | null
    municipio?: string | null
    colonia?: string | null
    description?: string | null
    facebook_url?: string | null
    instagram_url?: string | null
    photo_url?: string | null
    aliases?: string[] | null
    offerings?: string[] | null
  }
  defaultHours?: WeeklyHours
}

// secondary_category_ids se maneja como estado local (igual que aliases/offerings),
// no vía react-hook-form; por eso se omite del schema del cliente.
const clientSchema = businessFormSchema.omit({
  aliases: true,
  offerings: true,
  secondary_category_ids: true,
})
type ClientFormInput = Omit<BusinessFormInput, 'aliases' | 'offerings' | 'secondary_category_ids'>

export function BusinessForm({
  action,
  submitLabel,
  categories,
  defaults,
  defaultHours,
  lockedMunicipio,
  readOnly = false,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaults?.photo_url ?? null)
  const [aliases, setAliases] = useState<string[]>(defaults?.aliases ?? [])
  const [aliasInput, setAliasInput] = useState('')
  const [offerings, setOfferings] = useState<string[]>(defaults?.offerings ?? [])
  const [offeringInput, setOfferingInput] = useState('')
  const [secondaryIds, setSecondaryIds] = useState<string[]>(defaults?.secondary_category_ids ?? [])
  const [categorySearch, setCategorySearch] = useState('')
  const [hours, setHours] = useState<WeeklyHours>(defaultHours ?? {})
  const [showHours, setShowHours] = useState(() => Object.keys(defaultHours ?? {}).length > 0)
  const aliasInputRef = useRef<HTMLInputElement>(null)
  const offeringInputRef = useRef<HTMLInputElement>(null)
  // Al crear, el slug se deriva del nombre en vivo hasta que el admin lo edita a
  // mano. Al editar ya hay un slug asignado (circula en links) → no se sobreescribe.
  const [slugTouched, setSlugTouched] = useState(!!defaults?.slug)

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

  function addOffering(value: string) {
    const trimmed = value.trim()
    if (trimmed && !offerings.includes(trimmed)) {
      setOfferings((prev) => [...prev, trimmed])
    }
    setOfferingInput('')
  }

  function removeOffering(offering: string) {
    setOfferings((prev) => prev.filter((o) => o !== offering))
  }

  function onOfferingKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addOffering(offeringInput)
    } else if (e.key === 'Backspace' && offeringInput === '' && offerings.length > 0) {
      setOfferings((prev) => prev.slice(0, -1))
    }
  }

  function toggleSecondary(id: string, checked: boolean) {
    setSecondaryIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((c) => c !== id),
    )
  }

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      slug: defaults?.slug ?? '',
      primary_category_id: defaults?.primary_category_id ?? '',
      phone: normalizeMxPhone(defaults?.phone),
      phone_is_whatsapp: defaults?.phone_is_whatsapp ?? false,
      address: defaults?.address ?? '',
      maps_url: defaults?.maps_url ?? '',
      municipio: (lockedMunicipio ??
        defaults?.municipio ??
        'Vicente Guerrero') as (typeof MUNICIPIOS)[number],
      colonia: defaults?.colonia ?? '',
      description: defaults?.description ?? '',
      facebook_url: defaults?.facebook_url ?? '',
      instagram_url: defaults?.instagram_url ?? '',
      photo: null,
    },
  })

  const watchedName = useWatch({ control: form.control, name: 'name' })
  useEffect(() => {
    if (!slugTouched) form.setValue('slug', slugify(watchedName ?? ''))
  }, [watchedName, slugTouched, form])

  function onSubmit(values: ClientFormInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('slug', values.slug ?? '')
    fd.set('primary_category_id', values.primary_category_id)
    fd.set('secondary_category_ids', JSON.stringify(secondaryIds))
    fd.set('phone', values.phone)
    fd.set('phone_is_whatsapp', String(values.phone_is_whatsapp))
    fd.set('address', values.address ?? '')
    fd.set('maps_url', values.maps_url ?? '')
    fd.set('municipio', values.municipio)
    fd.set('colonia', values.colonia ?? '')
    fd.set('description', values.description ?? '')
    fd.set('facebook_url', values.facebook_url ?? '')
    fd.set('instagram_url', values.instagram_url ?? '')
    fd.set('aliases', JSON.stringify(aliases))
    fd.set('offerings', JSON.stringify(offerings))
    fd.set('hours', JSON.stringify(hours))
    if (values.photo) fd.set('photo', values.photo)
    startTransition(async () => {
      const result = await action({ error: null }, fd)
      if (result?.error) setServerError(result.error)
    })
  }

  const primaryId = useWatch({ control: form.control, name: 'primary_category_id' })
  const primaryType = categories.find((c) => c.id === primaryId)?.type

  const categoriesByType = {
    food: categories.filter((c) => c.type === 'food'),
    business: categories.filter((c) => c.type === 'business'),
  }

  const search = categorySearch.trim().toLowerCase()
  function matchesSearch(c: CategoryOption) {
    if (c.name.toLowerCase().includes(search)) return true
    return c.aliases?.some((a) => a.toLowerCase().includes(search)) ?? false
  }
  const filteredCategoriesByType = {
    food: primaryType && primaryType !== 'food' ? [] : categoriesByType.food.filter(matchesSearch),
    business:
      primaryType && primaryType !== 'business'
        ? []
        : categoriesByType.business.filter(matchesSearch),
  }
  const selectedSecondary = categories.filter((c) => secondaryIds.includes(c.id))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
        <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-4 border-0 p-0">
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
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  URL del negocio{' '}
                  <span className="text-muted-foreground font-normal">(link para compartir)</span>
                </FormLabel>
                <FormControl>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-sm">vichente.com/</span>
                    <Input
                      disabled={isPending}
                      placeholder="el-tunner"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        setSlugTouched(true)
                        // Normalización ligera mientras escribe (conserva guion final para
                        // seguir tecleando). El slugify() final ocurre al enviar (schema).
                        field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))
                      }}
                    />
                  </div>
                </FormControl>
                <p className="text-muted-foreground text-xs">
                  Se genera solo del nombre. Puedes personalizarlo: minúsculas y guiones.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primary_category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría principal</FormLabel>
                <FormControl>
                  <CategorySelect
                    categories={categories}
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v ?? '')
                      const newType = categories.find((c) => c.id === v)?.type
                      // La primaria nunca debe quedar también como secundaria,
                      // y las secundarias deben ser del mismo tipo que la principal.
                      setSecondaryIds((prev) =>
                        prev.filter((id) => {
                          if (id === v) return false
                          const c = categories.find((cat) => cat.id === id)
                          return c?.type === newType
                        }),
                      )
                    }}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Categorías adicionales{' '}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            {selectedSecondary.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedSecondary.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                    {c.name}
                    <button
                      type="button"
                      onClick={() => toggleSecondary(c.id, false)}
                      disabled={isPending}
                      className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                      aria-label={`Quitar ${c.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Buscar categoría..."
              disabled={isPending}
            />
            <div className="grid max-h-64 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-md border p-3">
              {(['food', 'business'] as const).map((type) => {
                const opts = filteredCategoriesByType[type].filter((c) => c.id !== primaryId)
                if (opts.length === 0) return null
                return (
                  <div key={type} className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">
                      {type === 'food' ? 'Comida y bebida' : 'Comercios y servicios'}
                    </p>
                    {opts.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={secondaryIds.includes(c.id)}
                          onCheckedChange={(v) => toggleSecondary(c.id, v === true)}
                          disabled={isPending}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )
              })}
              {filteredCategoriesByType.food.length === 0 &&
                filteredCategoriesByType.business.length === 0 && (
                  <p className="text-muted-foreground col-span-2 text-sm">
                    Sin resultados para &quot;{categorySearch}&quot;
                  </p>
                )}
            </div>
            <p className="text-muted-foreground text-xs">
              El negocio aparecerá también en estas categorías. La principal muestra el icono en la
              tarjeta.
            </p>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="municipio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Municipio</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => field.onChange(v)}
                    disabled={isPending || !!lockedMunicipio}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona municipio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MUNICIPIOS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lockedMunicipio && (
                    <p className="text-muted-foreground text-xs">
                      Tu municipio asignado. No se puede cambiar.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="colonia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Colonia <span className="text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej. Centro, La Joya…"
                      disabled={isPending}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Describe brevemente el negocio…"
                    disabled={isPending}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="facebook_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Facebook <span className="text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://facebook.com/…"
                      disabled={isPending}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instagram_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Instagram <span className="text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://instagram.com/…"
                      disabled={isPending}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Oferta <span className="text-muted-foreground font-normal">(qué vende / ofrece)</span>
            </label>
            <div
              className="border-input focus-within:ring-ring flex min-h-10 flex-wrap gap-1.5 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2"
              onClick={() => offeringInputRef.current?.focus()}
            >
              {offerings.map((offering) => (
                <span
                  key={offering}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                >
                  {offering}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeOffering(offering)
                    }}
                    disabled={isPending}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                ref={offeringInputRef}
                value={offeringInput}
                onChange={(e) => setOfferingInput(e.target.value)}
                onKeyDown={onOfferingKeyDown}
                onBlur={() => addOffering(offeringInput)}
                disabled={isPending}
                placeholder={offerings.length === 0 ? 'Ej. tacos, burritos, agua fresca…' : ''}
                className="min-w-32 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Productos o servicios. Ayudan a encontrar el negocio por lo que ofrece.
            </p>
          </div>

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
                      setPreviewUrl(
                        file ? URL.createObjectURL(file) : (defaults?.photo_url ?? null),
                      )
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
        </fieldset>

        {readOnly ? (
          <p className="text-muted-foreground text-sm">Solo lectura — negocio de otro municipio.</p>
        ) : (
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : submitLabel}
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
