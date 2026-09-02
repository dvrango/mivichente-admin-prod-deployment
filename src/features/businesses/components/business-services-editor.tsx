'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, User, UserX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PHOTO_ALLOWED_MIME } from '../schema'
import type { ServiceInput } from '../types'

type Props = {
  value: ServiceInput[]
  onChange: (services: ServiceInput[]) => void
  onRemove?: () => void
  // Título de la sección, derivado del tipo de categoría por el form padre
  // ("Menú" para comida, "Servicios" para el resto).
  label?: string
  disabled?: boolean
}

export const EMPTY_SERVICE: ServiceInput = {
  name: '',
  price: '',
  description: '',
  imageUrl: null,
  imageFile: null,
  imagePreviewUrl: null,
  isPublished: true,
  section: '',
  showInProfile: true,
}

export function BusinessServicesEditor({
  value,
  onChange,
  onRemove,
  label = 'Servicios',
  disabled,
}: Props) {
  const isFood = label === 'Menú'
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Índice de la fila cuya foto se está eligiendo (un solo <input> compartido).
  const targetIndex = useRef<number | null>(null)

  function update(
    index: number,
    field: 'name' | 'price' | 'description' | 'section',
    next: string,
  ) {
    onChange(value.map((s, i) => (i === index ? { ...s, [field]: next } : s)))
  }

  function add() {
    onChange([...value, { ...EMPTY_SERVICE }])
  }

  function toggleFlag(index: number, field: 'isPublished' | 'showInProfile') {
    onChange(value.map((s, i) => (i === index ? { ...s, [field]: !s[field] } : s)))
  }

  // Marca/desmarca "mostrar en el perfil" para TODA una sección de un jalón —
  // un menú de restaurante trae 80+ platillos y hacerlo fila por fila para
  // sacar "Bebidas" y "Bar" del perfil es inviable.
  function setSectionShowInProfile(section: string, next: boolean) {
    onChange(value.map((s) => (s.section.trim() === section ? { ...s, showInProfile: next } : s)))
  }

  // Secciones con nombre, en orden de aparición, con su estado agregado de
  // visibilidad en el perfil (todas dentro / todas fuera / mezcladas).
  const sectionSummary = (() => {
    const order: string[] = []
    const rows = new Map<string, ServiceInput[]>()
    for (const s of value) {
      const key = s.section.trim()
      if (!key) continue
      if (!rows.has(key)) {
        rows.set(key, [])
        order.push(key)
      }
      rows.get(key)!.push(s)
    }
    return order.map((name) => {
      const items = rows.get(name)!
      const shown = items.filter((s) => s.showInProfile).length
      return {
        name,
        count: items.length,
        allShown: shown === items.length,
        noneShown: shown === 0,
      }
    })
  })()

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
          {label} <span className="text-muted-foreground font-normal">(con precio)</span>
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

      {isFood && sectionSummary.length > 0 && (
        <div className="bg-muted/40 space-y-1.5 rounded-md border p-3">
          <p className="text-muted-foreground text-xs font-medium">
            Perfil por sección
            <span className="font-normal">
              {' '}
              — el menú de mesa siempre muestra todo; esto es solo qué sale en la ficha del negocio.
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sectionSummary.map((sec) => (
              <Button
                key={sec.name}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-7 gap-1.5 text-xs"
                onClick={() => setSectionShowInProfile(sec.name, !sec.allShown)}
                title={
                  sec.allShown
                    ? `"${sec.name}" está en el perfil — clic para sacar la sección`
                    : `"${sec.name}" está fuera del perfil — clic para meter la sección`
                }
              >
                {sec.allShown ? (
                  <User className="size-3" />
                ) : (
                  <UserX className={`size-3 ${sec.noneShown ? '' : 'opacity-50'}`} />
                )}
                {sec.name}
                <span className="text-muted-foreground">({sec.count})</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((service, i) => (
            <div
              key={i}
              className={`space-y-2 rounded-md border p-3 ${service.isPublished ? '' : 'opacity-60'}`}
            >
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
                {/* En celular nombre y precio se apilan. En una fila, el precio
                    de 8rem y los tres botones son anchos fijos que a ~360px no
                    dejan nada para el nombre: el input quedaba de ~0px y no se
                    veía lo tecleado. `min-w-0` para que sí pueda encoger dentro
                    del flex en vez de desbordarse. */}
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem]">
                  <Input
                    value={service.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    placeholder={isFood ? 'Ej. Charoelote' : 'Ej. Consulta nutricional'}
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
                    className={`size-8 ${service.isPublished ? '' : 'text-muted-foreground'}`}
                    disabled={disabled}
                    onClick={() => toggleFlag(i, 'isPublished')}
                    aria-label={service.isPublished ? 'Ocultar de la app' : 'Mostrar en la app'}
                    title={
                      service.isPublished
                        ? 'Visible en la app — clic para ocultar'
                        : 'Oculto — clic para publicar'
                    }
                  >
                    {service.isPublished ? (
                      <Eye className="size-3.5" />
                    ) : (
                      <EyeOff className="size-3.5" />
                    )}
                  </Button>
                  {isFood && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`size-8 ${service.showInProfile ? '' : 'text-muted-foreground'}`}
                      disabled={disabled}
                      onClick={() => toggleFlag(i, 'showInProfile')}
                      aria-label={
                        service.showInProfile
                          ? 'Ocultar del perfil (sigue en el menú de mesa)'
                          : 'Mostrar en el perfil'
                      }
                      title={
                        service.showInProfile
                          ? 'Visible en el perfil — clic para ocultar (sigue en el menú de mesa)'
                          : 'Oculto del perfil — clic para mostrar. Sigue en el menú de mesa si está publicado.'
                      }
                    >
                      {service.showInProfile ? (
                        <User className="size-3.5" />
                      ) : (
                        <UserX className="size-3.5" />
                      )}
                    </Button>
                  )}
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
              {isFood && (
                <Input
                  value={service.section}
                  onChange={(e) => update(i, 'section', e.target.value)}
                  placeholder="Sección del menú (opcional), ej. Bebidas"
                  disabled={disabled}
                />
              )}
              <Textarea
                rows={2}
                value={service.description}
                onChange={(e) => update(i, 'description', e.target.value)}
                placeholder={
                  isFood ? 'Ej. Contiene: jamón, piña, asadero' : 'Qué incluye (opcional)'
                }
                disabled={disabled}
              />
              {/* El menú de mesa parte la descripción en grupos de chips cuando
                  encuentra "Etiqueta: a, b, c" (landing/src/lib/menu-de-mesa.ts).
                  Sin esta ayuda el formato solo lo conoce quien lo escribió: el
                  menú de Divla's se capturó por SQL y nadie más habría sabido
                  que "Tamaños:" genera chips, ni que tiene que ir primero. */}
              {isFood && (
                <p className="text-muted-foreground text-xs">
                  Escribe cada grupo como <b>Etiqueta: a, b, c</b> y se muestra como chips en el
                  menú de mesa. Ej. <b>Tamaños: chica $90, mediana $220</b> ·{' '}
                  <b>Contiene: jamón, piña</b>. Si usas los dos, Tamaños va primero (si no, se mete
                  dentro de la otra lista). Se ven 6 por grupo; el resto queda tras un &quot;ver
                  más&quot;.
                </p>
              )}
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
        {isFood ? '+ Agregar platillo' : '+ Agregar servicio'}
      </Button>
      <p className="text-muted-foreground text-xs">
        {isFood
          ? 'Platillos del menú con su precio y foto. Deja el precio vacío si varía.'
          : 'Servicios o paquetes con costo propio. Deja el precio vacío si se cotiza. La foto es opcional.'}
      </p>
    </div>
  )
}
