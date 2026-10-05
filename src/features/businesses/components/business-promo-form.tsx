'use client'

import { useActionState, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PromoFormState } from '../actions'
import { PROMO_BODY_MAX, PROMO_TITLE_MAX, type PromoStatus } from '../promo'

const STATUS_LABEL: Record<PromoStatus, string> = {
  none: 'Sin promoción',
  off: 'Apagada',
  expired: 'Vencida',
  live: 'Se ve en la app',
}

const BODY_PLACEHOLDER = `Sodas italianas al 2x1
Pide 2 y paga 1, en estos sabores:
- Zarzamora
- Frambuesa

Frappés al 3x2
Pide 3 y paga 2, en estos sabores:
- Piña colada
- Moka blanco`

export function BusinessPromoForm({
  action,
  status,
  defaults,
  readOnly = false,
}: {
  action: (prev: PromoFormState, formData: FormData) => Promise<PromoFormState>
  status: PromoStatus
  defaults: {
    active: boolean
    title: string | null
    body: string | null
    ends_at: string | null
  }
  readOnly?: boolean
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null, saved: false })
  // Controlados a propósito: React 19 resetea un form con `action` al terminar,
  // y con `defaultValue` un error de validación borraba lo que el staff ya
  // había escrito. Además Base UI avisa si el `defaultValue` cambia después de
  // montar, que es justo lo que pasa cuando `revalidatePath` trae los datos
  // guardados.
  const [active, setActive] = useState(defaults.active)
  const [title, setTitle] = useState(defaults.title ?? '')
  const [body, setBody] = useState(defaults.body ?? '')
  const [endsAt, setEndsAt] = useState(defaults.ends_at ?? '')

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <fieldset disabled={readOnly || isPending} className="m-0 min-w-0 space-y-5 border-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
            Mostrar la promoción en la app
          </label>
          <Badge variant={status === 'live' ? 'default' : 'outline'}>{STATUS_LABEL[status]}</Badge>
          <input type="hidden" name="active" value={active ? 'on' : ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="promo-title">Título</Label>
          <Input
            id="promo-title"
            name="title"
            maxLength={PROMO_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sodas italianas al 2x1 y frappés al 3x2"
          />
          <p className="text-muted-foreground text-sm">
            Es lo que se lee en la tarjeta de la ficha. Escríbelo para el cliente, no como lo mandó
            el negocio.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="promo-body">Detalles y condiciones</Label>
          <Textarea
            id="promo-body"
            name="body"
            rows={12}
            maxLength={PROMO_BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={BODY_PLACEHOLDER}
          />
          <p className="text-muted-foreground text-sm">
            Separa cada oferta con un renglón en blanco. El primer renglón de cada oferta sale en
            negritas. Los renglones que empiezan con “-” salen como lista.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="promo-ends-at">Último día de la promoción (opcional)</Label>
          <Input
            id="promo-ends-at"
            name="ends_at"
            type="date"
            className="w-auto"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
          <p className="text-muted-foreground text-sm">
            Ese día todavía se ve. Al día siguiente desaparece sola de la app. Sin fecha, se ve
            hasta que la apagues.
          </p>
        </div>

        {state.error && <p className="text-destructive text-sm">{state.error}</p>}
        {state.saved && !state.error && <p className="text-sm text-green-700">Guardado.</p>}

        {!readOnly && (
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar promoción'}
          </Button>
        )}
      </fieldset>
    </form>
  )
}
