'use client'

import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ServiceInput } from '../types'

type Props = {
  value: ServiceInput[]
  onChange: (services: ServiceInput[]) => void
  onRemove?: () => void
  disabled?: boolean
}

const EMPTY_SERVICE: ServiceInput = { name: '', price: '', description: '' }

export function BusinessServicesEditor({ value, onChange, onRemove, disabled }: Props) {
  function update(index: number, field: keyof ServiceInput, next: string) {
    onChange(value.map((s, i) => (i === index ? { ...s, [field]: next } : s)))
  }

  function add() {
    onChange([...value, { ...EMPTY_SERVICE }])
  }

  function remove(index: number) {
    const next = value.filter((_, i) => i !== index)
    onChange(next)
    if (next.length === 0) onRemove?.()
  }

  // El orden del array es el order_index que se guarda, así que mover una fila
  // es literalmente reordenar el array.
  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium leading-none">
          Servicios <span className="text-muted-foreground font-normal">(con precio)</span>
        </label>
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange([])
              onRemove?.()
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((service, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-[1fr_8rem] gap-2">
                  <Input
                    value={service.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    placeholder="Ej. Consulta nutricional"
                    disabled={disabled}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={service.price}
                    onChange={(e) => update(i, 'price', e.target.value)}
                    placeholder="$ precio"
                    disabled={disabled}
                  />
                </div>
                <div className="flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Subir servicio"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={disabled || i === value.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Bajar servicio"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hover:text-destructive size-8"
                    disabled={disabled}
                    onClick={() => remove(i)}
                    aria-label="Quitar servicio"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                rows={2}
                value={service.description}
                onChange={(e) => update(i, 'description', e.target.value)}
                placeholder="Qué incluye (opcional)"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={add}>
        + Agregar servicio
      </Button>
      <p className="text-muted-foreground text-xs">
        Servicios o paquetes con costo propio. Deja el precio vacío si se cotiza.
      </p>
    </div>
  )
}
