'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form'
import type { CategoryOption } from '../types'

type Props = {
  search: string
  categoryId: string
  categories: CategoryOption[]
}

type FilterValues = { q: string; category: string }

export function BusinessesFilters({ search, categoryId, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FilterValues>({
    defaultValues: { q: search, category: categoryId },
  })

  function onSubmit(values: FilterValues) {
    const params = new URLSearchParams()
    if (values.q.trim()) params.set('q', values.q.trim())
    if (values.category) params.set('category', values.category)
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `/businesses?${qs}` : '/businesses')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap gap-2">
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormControl>
                <Input placeholder="Buscar por nombre…" className="max-w-xs" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormControl>
                <select
                  {...field}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          Filtrar
        </Button>
        {search || categoryId ? (
          <Link href="/businesses" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Limpiar
          </Link>
        ) : null}
      </form>
    </Form>
  )
}
