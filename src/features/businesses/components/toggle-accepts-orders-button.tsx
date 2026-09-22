'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleBusinessAcceptsOrders } from '../actions'

export function ToggleAcceptsOrdersButton({
  id,
  acceptsOrders,
}: {
  id: string
  acceptsOrders: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant={acceptsOrders ? 'destructive' : 'outline'}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleBusinessAcceptsOrders(id, !acceptsOrders))}
    >
      {pending ? '…' : acceptsOrders ? 'Desactivar pedidos' : 'Activar pedidos'}
    </Button>
  )
}
