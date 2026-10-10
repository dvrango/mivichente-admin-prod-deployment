'use client'

import { useActionState, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FeedbackRewardFormState } from '../actions'
import {
  FEEDBACK_REWARD_BENEFIT_MAX,
  FEEDBACK_REWARD_DAYS_MAX,
  FEEDBACK_REWARD_DAYS_MIN,
  feedbackRewardLastDay,
} from '../feedback-reward'

export function BusinessFeedbackRewardForm({
  action,
  businessIsActive,
  defaults,
}: {
  action: (prev: FeedbackRewardFormState, formData: FormData) => Promise<FeedbackRewardFormState>
  businessIsActive: boolean
  defaults: { active: boolean; benefit: string | null; days: number }
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null, saved: false })
  // Controlados por lo mismo que el form de la promoción: React 19 resetea un
  // form con `action` al terminar, y con `defaultValue` un error de validación
  // borraba lo que ya se había escrito.
  const [active, setActive] = useState(defaults.active)
  const [benefit, setBenefit] = useState(defaults.benefit ?? '')
  const [days, setDays] = useState(String(defaults.days))

  // El badge refleja lo guardado, no lo que se está escribiendo.
  const receives = defaults.active && businessIsActive
  const lastDay = feedbackRewardLastDay(days)

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <fieldset disabled={isPending} className="m-0 min-w-0 space-y-5 border-0 p-0">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
              Recibir opiniones a cambio de un descuento
            </label>
            <Badge variant={receives ? 'default' : 'outline'}>
              {receives ? 'Recibe opiniones' : 'No recibe opiniones'}
            </Badge>
            <input type="hidden" name="active" value={active ? 'on' : ''} />
          </div>
          {!businessIsActive && (
            <p className="text-sm text-amber-700">
              El negocio está inactivo: no recibe opiniones aunque esto esté prendido.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-benefit">Descuento que se lleva el cliente</Label>
          <Input
            id="feedback-benefit"
            name="benefit"
            maxLength={FEEDBACK_REWARD_BENEFIT_MAX}
            value={benefit}
            onChange={(e) => setBenefit(e.target.value)}
            placeholder="10%"
          />
          <p className="text-muted-foreground text-sm">
            Escríbelo corto: se lee en frases como «Obtener mi 10%» y «10% en tu próxima compra».
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-days">Días que vale el descuento</Label>
          <Input
            id="feedback-days"
            name="days"
            type="number"
            inputMode="numeric"
            min={FEEDBACK_REWARD_DAYS_MIN}
            max={FEEDBACK_REWARD_DAYS_MAX}
            step={1}
            className="w-28"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <p className="text-muted-foreground text-sm">
            {lastDay
              ? `Empiezan a contar al día siguiente de la opinión: una opinión que dejen hoy da un descuento que vale hasta el ${lastDay}, ese día incluido.`
              : 'Empiezan a contar al día siguiente de la opinión.'}
          </p>
        </div>

        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Cambiar el descuento o los días solo aplica a las opiniones nuevas. Los descuentos que ya
          se entregaron se quedan como estaban.
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
