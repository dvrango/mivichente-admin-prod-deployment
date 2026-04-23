'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleBusinessActive } from '../actions'

export function ToggleActiveButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleBusinessActive(id, !isActive))}
    >
      {pending ? '…' : isActive ? 'Desactivar' : 'Activar'}
    </Button>
  )
}
