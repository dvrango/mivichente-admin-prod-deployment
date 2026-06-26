'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleBusinessFeatured } from '../actions'

export function ToggleFeaturedButton({ id, isFeatured }: { id: string; isFeatured: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleBusinessFeatured(id, !isFeatured))}
    >
      {pending ? '…' : isFeatured ? 'Quitar recomendación' : 'Recomendar'}
    </Button>
  )
}
