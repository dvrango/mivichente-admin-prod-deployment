'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleBusinessVerified } from '../actions'

export function ToggleVerifiedButton({ id, isVerified }: { id: string; isVerified: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleBusinessVerified(id, !isVerified))}
    >
      {pending ? '…' : isVerified ? 'Quitar verificación' : 'Verificar'}
    </Button>
  )
}
