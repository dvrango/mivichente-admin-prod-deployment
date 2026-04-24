'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
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
import type { CategoryOption } from '../types'

type Props = {
  action: (prev: BusinessFormState, formData: FormData) => Promise<BusinessFormState>
  submitLabel: string
  categories: CategoryOption[]
  defaults?: {
    name?: string
    category_id?: string | null
    phone?: string
    address?: string | null
    schedule?: string | null
    photo_url?: string | null
  }
}

export function BusinessForm({ action, submitLabel, categories, defaults }: Props) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaults?.photo_url ?? null)

  const form = useForm<BusinessFormInput>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      category_id: defaults?.category_id ?? '',
      phone: normalizeMxPhone(defaults?.phone),
      address: defaults?.address ?? '',
      schedule: defaults?.schedule ?? '',
      photo: null,
    },
  })

  function onSubmit(values: BusinessFormInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('category_id', values.category_id)
    fd.set('phone', values.phone)
    fd.set('address', values.address ?? '')
    fd.set('schedule', values.schedule ?? '')
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

        <div className="grid gap-4 sm:grid-cols-2">
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
            name="schedule"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horario</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Lun-Vie 9:00-18:00"
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
