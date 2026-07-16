'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PHOTO_ALLOWED_MIME } from '../schema'
import type { PhotoInput } from '../types'

type Props = {
  value: PhotoInput[]
  onChange: (photos: PhotoInput[]) => void
  disabled?: boolean
}

export function BusinessGalleryEditor({ value, onChange, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function add(files: FileList | null) {
    if (!files || files.length === 0) return
    const added: PhotoInput[] = [...files].map((file) => ({
      url: null,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }))
    onChange([...value, ...added])
  }

  function remove(index: number) {
    const photo = value[index]
    // Sólo se revoca el object URL de las fotos nuevas; las guardadas apuntan
    // a storage y no hay nada que liberar.
    if (photo.file) URL.revokeObjectURL(photo.previewUrl)
    onChange(value.filter((_, i) => i !== index))
  }

  function setCaption(index: number, caption: string) {
    onChange(value.map((p, i) => (i === index ? { ...p, caption } : p)))
  }

  // El orden del array es el order_index, y la primera es la portada.
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
          Fotos{' '}
          <span className="text-muted-foreground font-normal">
            (JPG, PNG o WEBP — máx 5 MB c/u)
          </span>
        </label>
        {value.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {value.length} {value.length === 1 ? 'foto' : 'fotos'}
          </span>
        )}
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((photo, i) => (
            <div key={photo.url ?? photo.previewUrl} className="flex gap-3 rounded-md border p-3">
              <div className="relative shrink-0">
                <Image
                  src={photo.previewUrl}
                  alt={photo.caption || `Foto ${i + 1}`}
                  width={112}
                  height={84}
                  className="h-21 w-28 rounded object-cover"
                  unoptimized
                />
                {i === 0 && <Badge className="absolute -top-2 -left-2 text-[10px]">Portada</Badge>}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <Input
                  value={photo.caption}
                  onChange={(e) => setCaption(i, e.target.value)}
                  placeholder="Título de la foto (opcional) — ej. Fachada, Interior"
                  disabled={disabled}
                />
                {i === 0 && (
                  <p className="text-muted-foreground text-xs">
                    La portada es la que se ve en las tarjetas y al compartir el negocio.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-start gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Mover foto antes"
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={disabled || i === value.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Mover foto después"
                >
                  <ArrowRight className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hover:text-destructive size-8"
                  disabled={disabled}
                  onClick={() => remove(i)}
                  aria-label="Quitar foto"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={PHOTO_ALLOWED_MIME.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files)
          // Se limpia para poder volver a elegir el mismo archivo.
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        + Agregar fotos
      </Button>
      <p className="text-muted-foreground text-xs">
        Se recomiendan al menos 3: fachada, interior y productos o servicios.
      </p>
    </div>
  )
}
