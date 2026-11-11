'use client'

import { useOptimistic, useState, useTransition, type ReactNode } from 'react'
import { InfoTip } from '@/components/shared/info-tip'
import { Switch } from '@/components/ui/switch'
import {
  toggleBusinessAcceptsOrders,
  toggleBusinessActive,
  toggleBusinessDelivery,
  toggleBusinessFeatured,
  toggleBusinessVerified,
} from '../actions'

type Props = {
  id: string
  isActive: boolean
  isVerified: boolean
  isFeatured: boolean
  hasDelivery: boolean
  acceptsOrders: boolean
  /** Solo admin: `toggleBusinessAcceptsOrders` llama `requireAdmin()` y un trigger lo protege. */
  canManageOrders: boolean
  /** Reviewer viendo un negocio de otro municipio: la RLS rechazaría el update. */
  readOnly: boolean
}

/**
 * Los interruptores del negocio. Antes eran cinco botones sueltos en el header,
 * con el mismo estilo que los links a las subpáginas. Cada switch escribe al
 * instante con el mismo server action de siempre.
 */
export function BusinessStatusCard({
  id,
  isActive,
  isVerified,
  isFeatured,
  hasDelivery,
  acceptsOrders,
  canManageOrders,
  readOnly,
}: Props) {
  return (
    <section className="bg-card space-y-1 rounded-xl border p-4">
      <h2 className="mb-2 text-sm font-semibold">Estado</h2>
      <StatusRow
        label="Visible en la app"
        info="Apagado, el negocio no aparece en la app ni en vichente.com."
        checked={isActive}
        disabled={readOnly}
        onToggle={(next) => toggleBusinessActive(id, next)}
      />
      <StatusRow
        label="Verificado"
        info="Muestra la insignia de verificado en la tarjeta y en la ficha del negocio."
        checked={isVerified}
        disabled={readOnly}
        onToggle={(next) => toggleBusinessVerified(id, next)}
      />
      <StatusRow
        label="Recomendado"
        info="Aparece en la sección de recomendados de la app y sube en la búsqueda."
        checked={isFeatured}
        disabled={readOnly}
        onToggle={(next) => toggleBusinessFeatured(id, next)}
      />
      <StatusRow
        label="Envío a domicilio"
        info="El negocio entrega a domicilio. La condición del envío se captura en Datos → Envío."
        checked={hasDelivery}
        disabled={readOnly}
        onToggle={(next) => toggleBusinessDelivery(id, next)}
      />
      {canManageOrders && (
        <StatusRow
          label="Recibe pedidos"
          info="Acuerdo comercial con el negocio para recibir pedidos por la app. Solo lo cambia un admin."
          checked={acceptsOrders}
          disabled={readOnly}
          onToggle={(next) => toggleBusinessAcceptsOrders(id, next)}
        />
      )}
    </section>
  )
}

function StatusRow({
  label,
  info,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  info: ReactNode
  checked: boolean
  disabled: boolean
  onToggle: (next: boolean) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(checked)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-sm">{label}</span>
          <InfoTip label={`Qué es ${label.toLowerCase()}`}>{info}</InfoTip>
        </div>
        <Switch
          aria-label={label}
          checked={optimistic}
          disabled={disabled || pending}
          onCheckedChange={(next) => {
            setError(null)
            startTransition(async () => {
              setOptimistic(next)
              try {
                await onToggle(next)
              } catch {
                setError('No se pudo guardar. Intenta otra vez.')
              }
            })
          }}
        />
      </div>
      {error && (
        <p className="text-destructive mt-1 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
