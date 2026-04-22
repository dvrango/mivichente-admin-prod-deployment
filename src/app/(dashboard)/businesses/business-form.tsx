'use client'

import Image from 'next/image'
import { useActionState, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import type { BusinessFormState } from './actions'

type CategoryOption = { id: string; name: string }

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

const INITIAL: BusinessFormState = { error: null }

export function BusinessForm({ action, submitLabel, categories, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaults?.photo_url ?? null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setPreviewUrl(defaults?.photo_url ?? null)
      return
    }
    setPreviewUrl(URL.createObjectURL(file))
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
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
        <Label htmlFor="category_id">Categoría</Label>
        <Select
          name="category_id"
          defaultValue={defaults?.category_id ?? undefined}
          disabled={pending}
        >
          <SelectTrigger id="category_id" className="w-full">
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaults?.phone ?? ''}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule">Horario</Label>
          <Input
            id="schedule"
            name="schedule"
            placeholder="Lun-Vie 9:00-18:00"
            defaultValue={defaults?.schedule ?? ''}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Textarea
          id="address"
          name="address"
          rows={2}
          defaultValue={defaults?.address ?? ''}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">Foto (JPG, PNG, WEBP — máx 5 MB)</Label>
        <Input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          disabled={pending}
        />
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
