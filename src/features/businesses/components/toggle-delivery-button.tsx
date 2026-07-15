'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleBusinessDelivery } from '../actions'

export function ToggleDeliveryButton({ id, hasDelivery }: { id: string; hasDelivery: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleBusinessDelivery(id, !hasDelivery))}
    >
      {pending ? '…' : hasDelivery ? 'Quitar envío a domicilio' : 'Marcar envío a domicilio'}
    </Button>
  )
}
