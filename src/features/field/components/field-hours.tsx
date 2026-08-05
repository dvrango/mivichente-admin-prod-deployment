'use client'

import { useState } from 'react'
import type { WeeklyHours } from '@/features/businesses/types'

/**
 * Horario en modo campo.
 *
 * Nunca se piden 7 filas: parado en la calle no se llenan, y por eso el horario
 * se venía olvidando (la carnitería que vende hasta que se acaba es justo donde
 * el horario ES el dato). Dos presets de un toque cubren casi todo el pueblo, y
 * queda la salida de texto libre para el que abre "cuando hay masa".
 */

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
const MON_TO_SAT = [1, 2, 3, 4, 5, 6]

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

// Arranque del segundo turno de un día partido (cierra a comer, reabre en la
// tarde). Sólo valores iniciales, se editan encima.
const DEFAULT_SECOND_OPEN = '16:00'
const DEFAULT_SECOND_CLOSE = '21:00'

const MAX_SHIFTS = 2

/**
 * Negocios que legítimamente no tienen tabla de horarios. Un psicólogo trabaja
 * previa cita: no es un dato faltante, es SU horario. Se guardan como texto en
 * `businesses.schedule`, editable después.
 */
const NO_SCHEDULE_PRESETS = ['Previa cita', 'A domicilio', 'Sin horario fijo']

type Mode = 'none' | 'todos' | 'lunsab' | 'custom' | 'texto'

/** Los presets manejan un solo turno; con horario partido no aplican. */
function hasSplitShift(hours: WeeklyHours): boolean {
  return Object.values(hours).some((shifts) => (shifts?.length ?? 0) > 1)
}

function sameDays(hours: WeeklyHours, days: number[]): boolean {
  if (hasSplitShift(hours)) return false
  const open = Object.keys(hours)
    .map(Number)
    .sort((a, b) => a - b)
  if (open.length !== days.length) return false
  if (!days.every((d) => hours[d]?.length)) return false
  const first = hours[days[0]]![0]
  return days.every(
    (d) => hours[d]![0].opens_at === first.opens_at && hours[d]![0].closes_at === first.closes_at,
  )
}

function initialMode(hours: WeeklyHours, scheduleText: string): Mode {
  if (sameDays(hours, EVERY_DAY)) return 'todos'
  if (sameDays(hours, MON_TO_SAT)) return 'lunsab'
  // Un horario partido siempre entra por "personalizar": los presets sólo
  // saben de un rango, y aplicarlos borraría el segundo turno.
  if (Object.keys(hours).length > 0) return 'custom'
  if (scheduleText.trim()) return 'texto'
  return 'none'
}

function buildHours(days: number[], opensAt: string, closesAt: string): WeeklyHours {
  const next: WeeklyHours = {}
  for (const day of days) next[day] = [{ opens_at: opensAt, closes_at: closesAt }]
  return next
}

export function FieldHours({
  value,
  scheduleText,
  onHoursChange,
  onScheduleChange,
  onScheduleBlur,
}: {
  value: WeeklyHours
  scheduleText: string
  onHoursChange: (hours: WeeklyHours) => void
  onScheduleChange: (text: string) => void
  onScheduleBlur: () => void
}) {
  const [mode, setMode] = useState<Mode>(() => initialMode(value, scheduleText))

  const firstEntry = Object.values(value).find((s) => s && s.length > 0)?.[0]
  const opensAt = firstEntry?.opens_at ?? DEFAULT_OPEN
  const closesAt = firstEntry?.closes_at ?? DEFAULT_CLOSE

  function applyPreset(next: Mode) {
    setMode(next)
    if (next === 'todos') onHoursChange(buildHours(EVERY_DAY, opensAt, closesAt))
    else if (next === 'lunsab') onHoursChange(buildHours(MON_TO_SAT, opensAt, closesAt))
    else if (next === 'custom' && Object.keys(value).length === 0) {
      onHoursChange(buildHours(MON_TO_SAT, opensAt, closesAt))
    } else if (next === 'texto') onHoursChange({})
  }

  /**
   * Respuestas que NO son una tabla de horarios pero sí son la respuesta real
   * ("previa cita" en un psicólogo, "hasta que se acaba" en unas carnitas). Van
   * a `businesses.schedule` de un toque, sin teclear: la app las pinta tal cual
   * cuando el negocio no tiene filas en `business_hours`.
   */
  function applyScheduleText(text: string) {
    setMode('texto')
    onHoursChange({})
    onScheduleChange(text)
    onScheduleBlur()
  }

  function changeRange(field: 'opens_at' | 'closes_at', time: string) {
    const days = mode === 'todos' ? EVERY_DAY : MON_TO_SAT
    onHoursChange(
      buildHours(
        days,
        field === 'opens_at' ? time : opensAt,
        field === 'closes_at' ? time : closesAt,
      ),
    )
  }

  function toggleDay(day: number, open: boolean) {
    const next = { ...value }
    if (open) next[day] = [{ opens_at: opensAt, closes_at: closesAt }]
    else delete next[day]
    onHoursChange(next)
  }

  function changeDay(day: number, index: number, field: 'opens_at' | 'closes_at', time: string) {
    const shifts = value[day]
    if (!shifts?.[index]) return
    onHoursChange({
      ...value,
      [day]: shifts.map((s, i) => (i === index ? { ...s, [field]: time } : s)),
    })
  }

  /** Segundo turno del día: abre en la mañana, cierra a comer, reabre. */
  function addShift(day: number) {
    const shifts = value[day]
    if (!shifts || shifts.length >= MAX_SHIFTS) return
    onHoursChange({
      ...value,
      [day]: [...shifts, { opens_at: DEFAULT_SECOND_OPEN, closes_at: DEFAULT_SECOND_CLOSE }],
    })
  }

  function removeShift(day: number, index: number) {
    const shifts = value[day]
    if (!shifts) return
    const nextShifts = shifts.filter((_, i) => i !== index)
    if (nextShifts.length === 0) return toggleDay(day, false)
    onHoursChange({ ...value, [day]: nextShifts })
  }

  function reset() {
    setMode('none')
    onHoursChange({})
    onScheduleChange('')
  }

  return (
    <section id="campo-horario" className="scroll-mt-20 border-t px-4 py-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Horario</h2>
        {mode !== 'none' && (
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground min-h-9 text-sm underline"
          >
            Cambiar
          </button>
        )}
      </div>

      {mode === 'none' && (
        <div className="flex flex-col gap-2">
          <PresetButton label="Todos los días" onClick={() => applyPreset('todos')} />
          <PresetButton label="Lun – Sáb" onClick={() => applyPreset('lunsab')} />
          <PresetButton label="Personalizar por día" onClick={() => applyPreset('custom')} />

          <p className="text-muted-foreground mt-2 text-sm">No maneja horario:</p>
          <div className="flex flex-wrap gap-2">
            {NO_SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyScheduleText(preset)}
                className="border-input min-h-12 rounded-full border px-4 text-base active:translate-y-px"
              >
                {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyPreset('texto')}
              className="text-muted-foreground min-h-12 px-2 text-sm underline"
            >
              Otro
            </button>
          </div>
        </div>
      )}

      {(mode === 'todos' || mode === 'lunsab') && (
        <>
          <p className="text-muted-foreground mb-3 text-sm">
            {mode === 'todos' ? 'Todos los días' : 'Lunes a sábado'}
          </p>
          <div className="flex items-center gap-3">
            <TimeInput label="Abre" value={opensAt} onChange={(t) => changeRange('opens_at', t)} />
            <TimeInput
              label="Cierra"
              value={closesAt}
              onChange={(t) => changeRange('closes_at', t)}
            />
          </div>
        </>
      )}

      {mode === 'custom' && (
        <ul className="divide-y rounded-xl border">
          {EVERY_DAY.map((day) => {
            const shifts = value[day] ?? []
            const isOpen = shifts.length > 0
            return (
              <li key={day} className="flex items-start gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleDay(day, !isOpen)}
                  aria-pressed={isOpen}
                  className={`min-h-11 w-14 shrink-0 rounded-lg text-sm font-medium ${
                    isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
                {isOpen ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {shifts.map((hours, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          aria-label={`Abre ${DAY_LABELS[day]}${i > 0 ? ' turno 2' : ''}`}
                          value={hours.opens_at}
                          onChange={(e) => changeDay(day, i, 'opens_at', e.target.value)}
                          className="border-input h-12 min-w-0 flex-1 rounded-lg border px-2 text-base"
                        />
                        <span className="text-muted-foreground">–</span>
                        <input
                          type="time"
                          aria-label={`Cierra ${DAY_LABELS[day]}${i > 0 ? ' turno 2' : ''}`}
                          value={hours.closes_at}
                          onChange={(e) => changeDay(day, i, 'closes_at', e.target.value)}
                          className="border-input h-12 min-w-0 flex-1 rounded-lg border px-2 text-base"
                        />
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => removeShift(day, i)}
                            aria-label={`Quitar turno 2 de ${DAY_LABELS[day]}`}
                            className="text-muted-foreground min-h-11 px-2 text-sm underline"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    ))}
                    {shifts.length < MAX_SHIFTS && (
                      <button
                        type="button"
                        onClick={() => addShift(day)}
                        className="text-muted-foreground min-h-11 self-start text-sm underline"
                      >
                        + Otro turno (cierra a comer)
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground mt-3 text-sm">Cerrado</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {mode === 'texto' && (
        <input
          value={scheduleText}
          autoFocus={!scheduleText}
          onChange={(e) => onScheduleChange(e.target.value)}
          onBlur={onScheduleBlur}
          placeholder="Ej. hasta que se acaba la carne"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
        />
      )}
    </section>
  )
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-input flex h-14 w-full items-center justify-center rounded-xl border text-base font-medium active:translate-y-px"
    >
      {label}
    </button>
  )
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (time: string) => void
}) {
  return (
    <label className="flex-1">
      <span className="text-muted-foreground mb-1 block text-sm">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background h-14 w-full rounded-xl border px-3 text-base outline-none"
      />
    </label>
  )
}
