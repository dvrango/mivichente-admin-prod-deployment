'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleCategoryActive } from './actions'

export function ToggleActiveButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleCategoryActive(id, !isActive))}
    >
      {pending ? '…' : isActive ? 'Desactivar' : 'Activar'}
    </Button>
  )
}
