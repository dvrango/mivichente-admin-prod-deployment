'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CategoryType } from '@/lib/types'
import type { CategoryFormState } from './actions'

type Props = {
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>
  submitLabel: string
  defaults?: {
    name?: string
    icon?: string | null
    type?: CategoryType
  }
}

const INITIAL: CategoryFormState = { error: null }

export function CategoryForm({ action, submitLabel, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL)

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults?.name ?? ''}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="icon">Icono (emoji o texto)</Label>
        <Input
          id="icon"
          name="icon"
          defaultValue={defaults?.icon ?? ''}
          placeholder="🍔"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Tipo</Label>
        <Select name="type" defaultValue={defaults?.type ?? 'food'} disabled={pending}>
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="food">Comida</SelectItem>
            <SelectItem value="business">Negocios</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
