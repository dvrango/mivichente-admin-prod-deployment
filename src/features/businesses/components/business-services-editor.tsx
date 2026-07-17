'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PHOTO_ALLOWED_MIME } from '../schema'
import type { ServiceInput } from '../types'

type Props = {
  value: ServiceInput[]
  onChange: (services: ServiceInput[]) => void
  onRemove?: () => void
  disabled?: boolean
}

const EMPTY_SERVICE: ServiceInput = {
  name: '',
  price: '',
  description: '',
  imageUrl: null,
  imageFile: null,
  imagePreviewUrl: null,
}

export function BusinessServicesEditor({ value, onChange, onRemove, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Índice de la fila cuya foto se está eligiendo (un solo <input> compartido).
  const targetIndex = useRef<number | null>(null)

  function update(index: number, field: 'name' | 'price' | 'description', next: string) {
    onChange(value.map((s, i) => (i === index ? { ...s, [field]: next } : s)))
  }

  function add() {
    onChange([...value, { ...EMPTY_SERVICE }])
  }

  function remove(index: number) {
    const service = value[index]
    if (service.imageFile && service.imagePreviewUrl) URL.revokeObjectURL(service.imagePreviewUrl)
    const next = value.filter((_, i) => i !== index)
    onChange(next)
    if (next.length === 0) onRemove?.()
  }

  function pickImage(index: number) {
    targetIndex.current = index
    fileInputRef.current?.click()
  }

  function setImage(files: FileList | null) {
    const index = targetIndex.current
    if (index === null || !files || files.length === 0) return
    const file = files[0]
    onChange(
      value.map((s, i) => {
        if (i !== index) return s
        // Reemplazo: libera el object URL de la foto local anterior.
        if (s.imageFile && s.imagePreviewUrl) URL.revokeObjectURL(s.imagePreviewUrl)
        return { ...s, imageFile: file, imagePreviewUrl: URL.createObjectURL(file) }
      }),
    )
  }

  function removeImage(index: number) {
    onChange(
      value.map((s, i) => {
        if (i !== index) return s
        if (s.imageFile && s.imagePreviewUrl) URL.revokeObjectURL(s.imagePreviewUrl)
        return { ...s, imageUrl: null, imageFile: null, imagePreviewUrl: null }
      }),
    )
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
                {service.imagePreviewUrl ? (
                  <div className="relative shrink-0">
                    <Image
                      src={service.imagePreviewUrl}
                      alt={service.name || `Servicio ${i + 1}`}
                      width={56}
                      height={56}
                      className="size-14 rounded object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      disabled={disabled}
                      className="bg-background hover:text-destructive absolute -top-2 -right-2 rounded-full border p-0.5"
                      aria-label="Quitar foto del servicio"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => pickImage(i)}
                    disabled={disabled}
                    className="text-muted-foreground hover:border-foreground/40 hover:text-foreground flex size-14 shrink-0 items-center justify-center rounded border border-dashed"
                    aria-label="Agregar foto del servicio"
                  >
                    <ImagePlus className="size-5" />
                  </button>
                )}
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

      <input
        ref={fileInputRef}
        type="file"
        accept={PHOTO_ALLOWED_MIME.join(',')}
        className="hidden"
        onChange={(e) => {
          setImage(e.target.files)
          // Se limpia para poder volver a elegir el mismo archivo.
          e.target.value = ''
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={add}>
        + Agregar servicio
      </Button>
      <p className="text-muted-foreground text-xs">
        Servicios o paquetes con costo propio. Deja el precio vacío si se cotiza. La foto es
        opcional — útil para menús de comida (un platillo por servicio).
      </p>
    </div>
  )
}
