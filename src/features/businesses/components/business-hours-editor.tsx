'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { WeeklyHours } from '../types'

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

// Segundo turno de un día partido: el patrón de la plaza es cerrar a comer y
// reabrir en la tarde. Son sólo valores de arranque, se editan encima.
const DEFAULT_SECOND_OPEN = '16:00'
const DEFAULT_SECOND_CLOSE = '21:00'

const MAX_SHIFTS = 2

type Props = {
  value: WeeklyHours
  onChange: (hours: WeeklyHours) => void
  onRemove?: () => void
  disabled?: boolean
}

export function BusinessHoursEditor({ value, onChange, onRemove, disabled }: Props) {
  function toggle(day: number, open: boolean) {
    if (open) {
      onChange({ ...value, [day]: [{ opens_at: DEFAULT_OPEN, closes_at: DEFAULT_CLOSE }] })
    } else {
      const next = { ...value }
      delete next[day]
      onChange(next)
    }
  }

  function update(day: number, index: number, field: 'opens_at' | 'closes_at', time: string) {
    const shifts = value[day]
    if (!shifts?.[index]) return
    const nextShifts = shifts.map((s, i) => (i === index ? { ...s, [field]: time } : s))
    onChange({ ...value, [day]: nextShifts })
  }

  /** Segundo turno del día (horario partido). */
  function addShift(day: number) {
    const shifts = value[day]
    if (!shifts || shifts.length >= MAX_SHIFTS) return
    onChange({
      ...value,
      [day]: [...shifts, { opens_at: DEFAULT_SECOND_OPEN, closes_at: DEFAULT_SECOND_CLOSE }],
    })
  }

  function removeShift(day: number, index: number) {
    const shifts = value[day]
    if (!shifts) return
    const nextShifts = shifts.filter((_, i) => i !== index)
    // Quitar el único turno equivale a cerrar el día.
    if (nextShifts.length === 0) return toggle(day, false)
    onChange({ ...value, [day]: nextShifts })
  }

  function copyMonToWeekdays() {
    const mon = value[1]
    if (!mon) return
    const next = { ...value }
    for (const d of [2, 3, 4, 5]) next[d] = mon.map((s) => ({ ...s }))
    onChange(next)
  }

  function applyToAll() {
    const first = Object.values(value).find((s) => s && s.length > 0)
    if (!first) return
    const next: WeeklyHours = {}
    for (const d of [0, 1, 2, 3, 4, 5, 6]) next[d] = first.map((s) => ({ ...s }))
    onChange(next)
  }

  function clearAll() {
    onChange({})
    onRemove?.()
  }

  const monOpen = !!value[1]?.length
  const hasAny = Object.values(value).some((s) => s && s.length > 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium leading-none">Horarios</label>
        <div className="flex gap-2">
          {monOpen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={copyMonToWeekdays}
            >
              Lun - Vie mismo horario
            </Button>
          )}
          {hasAny && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={applyToAll}
              >
                Poner mismo horario a todos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={clearAll}
              >
                Limpiar
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="divide-y rounded-md border">
        {DAYS.map(({ value: day, label }) => {
          const shifts = value[day] ?? []
          const isOpen = shifts.length > 0
          return (
            <div key={day} className="flex items-start gap-3 px-3 py-2.5">
              <Checkbox
                id={`day-${day}`}
                checked={isOpen}
                onCheckedChange={(v) => toggle(day, !!v)}
                disabled={disabled}
                className="mt-2.5"
              />
              <label
                htmlFor={`day-${day}`}
                className="mt-2 w-8 cursor-pointer text-sm font-medium select-none"
              >
                {label}
              </label>
              {isOpen ? (
                <div className="flex flex-col gap-2">
                  {shifts.map((hours, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`Abre ${label}${i > 0 ? ' (turno 2)' : ''}`}
                        value={hours.opens_at}
                        onChange={(e) => update(day, i, 'opens_at', e.target.value)}
                        disabled={disabled}
                        className="w-28"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="time"
                        aria-label={`Cierra ${label}${i > 0 ? ' (turno 2)' : ''}`}
                        value={hours.closes_at}
                        onChange={(e) => update(day, i, 'closes_at', e.target.value)}
                        disabled={disabled}
                        className="w-28"
                      />
                      {i > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => removeShift(day, i)}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                  ))}
                  {shifts.length < MAX_SHIFTS && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start px-0"
                      disabled={disabled}
                      onClick={() => addShift(day)}
                    >
                      + Otro turno (cierra a comer)
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground mt-2 text-sm">Cerrado</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
