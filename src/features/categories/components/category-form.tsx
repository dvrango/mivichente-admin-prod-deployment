'use client'

import { useState, useTransition } from 'react'
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
  }
}

const TYPE_ITEMS = [
  { value: 'food', label: 'Comida' },
  { value: 'business', label: 'Negocios' },
]

export function CategoryForm({ action, submitLabel, defaults }: Props) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CategoryFormInput>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      icon: defaults?.icon ?? '',
      type: defaults?.type ?? 'food',
    },
  })

  function onSubmit(values: CategoryFormInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set('name', values.name)
    fd.set('icon', values.icon ?? '')
    fd.set('type', values.type)
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
