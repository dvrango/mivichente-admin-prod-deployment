'use client'

import { useActionState, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StampCardFormState } from '../actions'
import { STAMP_CARD_REWARD_MAX, STAMP_CARD_STAMPS_MAX, STAMP_CARD_STAMPS_MIN } from '../stamp-card'

// Mismo patrón que `BusinessFeedbackRewardForm` (A1 y A2 del mockup
// `mvp-design/tarjeta-de-sellos/`, aprobados el 2026-11-03).
export function BusinessStampCardForm({
  action,
  businessIsActive,
  hasOwner,
  defaults,
}: {
  action: (prev: StampCardFormState, formData: FormData) => Promise<StampCardFormState>
  businessIsActive: boolean
  hasOwner: boolean
  defaults: { active: boolean; stampsRequired: number | null; reward: string | null }
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null, saved: false })
  // Controlados: React 19 resetea un form con `action` al terminar, y con
  // `defaultValue` un error de validación borraba lo que ya se había escrito.
  const [active, setActive] = useState(defaults.active)
  const [stamps, setStamps] = useState(
    defaults.stampsRequired === null ? '' : String(defaults.stampsRequired),
  )
  const [reward, setReward] = useState(defaults.reward ?? '')

  // El badge refleja lo guardado, no lo que se está escribiendo. Mismo criterio
  // que `get_or_create_stamp_card`: un negocio inactivo no da tarjetas.
  const gives = defaults.active && businessIsActive
  const rewardExample = reward.trim() || 'frappé gratis'

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={isPending} className="m-0 min-w-0 space-y-5 border-0 p-0">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
              Dar tarjeta de sellos a los clientes
            </label>
            <Badge variant={gives ? 'default' : 'outline'}>
              {gives ? 'Da tarjetas' : 'No da tarjetas'}
            </Badge>
            <input type="hidden" name="active" value={active ? 'on' : ''} />
          </div>
          {!hasOwner && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Este negocio no tiene dueño con cuenta: nadie podría dar sellos. Crea su cuenta antes
              de prenderlo.
            </p>
          )}
          {!businessIsActive && (
            <p className="text-sm text-amber-700">
              El negocio está inactivo: no da tarjetas aunque esto esté prendido.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stamp-card-stamps">Sellos para llenar la tarjeta</Label>
          <Input
            id="stamp-card-stamps"
            name="stampsRequired"
            type="number"
            inputMode="numeric"
            min={STAMP_CARD_STAMPS_MIN}
            max={STAMP_CARD_STAMPS_MAX}
            step={1}
            className="w-28"
            value={stamps}
            onChange={(e) => setStamps(e.target.value)}
            placeholder="8"
          />
          <p className="text-muted-foreground text-sm">
            Un sello por compra o visita, sin importar cuánto gastó. Entre {STAMP_CARD_STAMPS_MIN} y{' '}
            {STAMP_CARD_STAMPS_MAX}.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stamp-card-reward">Premio</Label>
          <Input
            id="stamp-card-reward"
            name="reward"
            maxLength={STAMP_CARD_REWARD_MAX}
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            placeholder="frappé gratis"
          />
          <p className="text-muted-foreground text-sm">
            Escríbelo sin «un»: se lee en frases como «Te faltan 3 para tu {rewardExample}». Lo
            elige y lo paga el negocio.
          </p>
        </div>

        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Si cambias los sellos o el premio, las tarjetas que ya van a medias se quedan como
          estaban; el cambio aplica desde la siguiente. Si apagas la tarjeta, ya no se dan tarjetas
          ni sellos, pero un premio ya ganado se puede canjear.
        </p>

        {state.error && <p className="text-destructive text-sm">{state.error}</p>}
        {state.saved && !state.error && <p className="text-sm text-green-700">Guardado.</p>}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </fieldset>
    </form>
  )
}
