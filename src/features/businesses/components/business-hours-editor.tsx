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

type Props = {
  value: WeeklyHours
  onChange: (hours: WeeklyHours) => void
  onRemove?: () => void
  disabled?: boolean
}

export function BusinessHoursEditor({ value, onChange, onRemove, disabled }: Props) {
  function toggle(day: number, open: boolean) {
    if (open) {
      onChange({ ...value, [day]: { opens_at: DEFAULT_OPEN, closes_at: DEFAULT_CLOSE } })
    } else {
      const next = { ...value }
      delete next[day]
      onChange(next)
    }
  }

  function update(day: number, field: 'opens_at' | 'closes_at', time: string) {
    const existing = value[day]
    if (!existing) return
    onChange({ ...value, [day]: { ...existing, [field]: time } })
  }

  function copyMonToWeekdays() {
    const mon = value[1]
    if (!mon) return
    const next = { ...value }
    for (const d of [2, 3, 4, 5]) next[d] = { ...mon }
    onChange(next)
  }

  function applyToAll() {
    const first = Object.values(value).find(Boolean)
    if (!first) return
    const next: WeeklyHours = {}
    for (const d of [0, 1, 2, 3, 4, 5, 6]) next[d] = { ...first }
    onChange(next)
  }

  function clearAll() {
    onChange({})
    onRemove?.()
  }

  const monOpen = !!value[1]
  const hasAny = Object.values(value).some(Boolean)

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
          const hours = value[day]
          const isOpen = !!hours
          return (
            <div key={day} className="flex items-center gap-3 px-3 py-2.5">
              <Checkbox
                id={`day-${day}`}
                checked={isOpen}
                onCheckedChange={(v) => toggle(day, !!v)}
                disabled={disabled}
              />
              <label
                htmlFor={`day-${day}`}
                className="w-8 cursor-pointer text-sm font-medium select-none"
              >
                {label}
              </label>
              {isOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={hours.opens_at}
                    onChange={(e) => update(day, 'opens_at', e.target.value)}
                    disabled={disabled}
                    className="w-28"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    type="time"
                    value={hours.closes_at}
                    onChange={(e) => update(day, 'closes_at', e.target.value)}
                    disabled={disabled}
                    className="w-28"
                  />
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Cerrado</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
