'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ─────────────────────────────────────────────────────────────────────────────
// REGLA DE LAYOUT DE ESTE ARCHIVO (no la rompas, ya costó un bug en prod):
//
// Cada campo que se teclea ocupa SU PROPIA FILA COMPLETA. Ningún input comparte
// fila con un control de ancho fijo (precio de 8rem, botones de ícono, thumb de
// foto). Ese es exactamente el layout que a 360px dejaba el input del nombre en
// ~0px de ancho en el editor viejo (`businesses/components/business-services-editor.tsx`,
// borrado el 2026-09-02 al sacar el menú del form; está en el historial de git).
//
// Ahí se parchó con `min-w-0`, que es un parche: el input sigue peleando por
// ancho, nada más que ahora encoge en vez de desbordar. Acá el bug es
// IMPOSIBLE, no parchado, porque no hay nada más en la fila con qué pelear.
//
// Lo único que comparte fila son botones con texto dentro de un `grid` de
// columnas iguales (`grid-cols-2` / `grid-cols-3`): reparten el ancho a partes
// iguales en vez de reclamar píxeles fijos.
//
// Los inputs de components/ui ya son `text-base` en móvil (16px) y `md:text-sm`,
// o sea NO disparan el zoom automático de iOS al enfocar. No redefinir su
// font-size.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qué hacer con la foto al guardar. Se resuelve HASTA el guardado, nunca al
 * elegir el archivo: subir al momento de elegir dejaría un huérfano en el bucket
 * cada vez que alguien pica una foto y luego cancela.
 */
export type PhotoIntent = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; file: File }

/**
 * Las TRES combinaciones válidas de `is_published` + `show_in_profile`.
 *
 * La cuarta (oculto pero en el perfil) no existe: el perfil sólo muestra lo
 * publicado y el menú de mesa es su superconjunto por diseño. Antes esto eran
 * dos botones sueltos, uno de los cuales se deshabilitaba según el otro — o
 * sea, una jerarquía disfrazada de dos interruptores independientes, y nadie
 * entendía si tocarlos prendía o apagaba. El mapeo a booleans vive en
 * `menu-editor.tsx`, que es quien habla con el server.
 */
export type MenuVisibility = 'ambos' | 'solo_qr' | 'oculto'

export type MenuDraft = {
  name: string
  price: string
  section: string
  description: string
  visibility: MenuVisibility
  photo: PhotoIntent
}

export type MenuDraftInitial = {
  name: string
  price: string
  section: string
  description: string
  visibility: MenuVisibility
  imageUrl: string | null
}

const SIN_SECCION = ''

/** El orden es de más visible a menos: es como se lee la pregunta. */
const VISIBILITY_OPTIONS: { value: MenuVisibility; label: string }[] = [
  { value: 'ambos', label: 'En la app y en el menú del QR' },
  { value: 'solo_qr', label: 'Solo en el menú del QR' },
  { value: 'oculto', label: 'Nadie (oculto)' },
]

/** Mismo texto que el chip, para la vista de sólo lectura del editor. */
export function visibilityLabel(visibility: MenuVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.label ?? ''
}

type Props = {
  /** 'nuevo' cambia el copy y el botón; el layout es el mismo a propósito. */
  mode: 'nuevo' | 'editar'
  /** "platillo" o "servicio", derivado del título del negocio. */
  word: string
  /** Copy de ayuda del formato de chips del menú de mesa (solo para comida). */
  isMenu: boolean
  initial: MenuDraftInitial
  /** Secciones que ya existen en este negocio, en orden de aparición. */
  sections: string[]
  saving: boolean
  error: string | null
  onSave: (draft: MenuDraft) => void
  onCancel: () => void
}

export function MenuItemForm({
  mode,
  word,
  isMenu,
  initial,
  sections,
  saving,
  error,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial.name)
  const [price, setPrice] = useState(initial.price)
  const [section, setSection] = useState(initial.section)
  const [description, setDescription] = useState(initial.description)
  const [visibility, setVisibility] = useState<MenuVisibility>(initial.visibility)

  // La sección tecleada a mano sólo aparece cuando se pide: con 13 secciones ya
  // capturadas, teclear es la excepción y elegir es la regla — y teclear es
  // justo cómo nacen "Bebidas" y "bebidas" como dos secciones distintas.
  const [customOpen, setCustomOpen] = useState(
    initial.section !== SIN_SECCION && !sections.includes(initial.section),
  )

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // El object URL del preview local se revoca al desmontar o al reemplazarlo.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (mode === 'nuevo') nameRef.current?.focus()
  }, [mode])

  const shownPhoto = previewUrl ?? (photoRemoved ? null : initial.imageUrl)

  function pickFile(files: FileList | null) {
    const next = files?.[0]
    if (!next) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
    setPhotoRemoved(false)
  }

  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setPhotoRemoved(true)
  }

  function submit() {
    const photo: PhotoIntent = file
      ? { kind: 'new', file }
      : photoRemoved
        ? { kind: 'remove' }
        : { kind: 'keep' }
    onSave({ name, price, section, description, visibility, photo })
  }

  return (
    // El tope de ancho es SÓLO de escritorio y sólo por legibilidad (un input de
    // precio de 950px se ve absurdo). En móvil no aplica: ahí cada campo usa
    // todo el ancho, que es lo que hace imposible el bug de los 360px.
    <div className="space-y-3 md:max-w-2xl">
      {/* Nombre — fila completa, sin vecinos. */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`nombre-${mode}`}>
          Nombre
        </label>
        <Input
          id={`nombre-${mode}`}
          ref={nameRef}
          className="h-11 md:h-9"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isMenu ? 'Ej. Aguachile de camarón' : 'Ej. Uñas acrílicas'}
          disabled={saving}
        />
      </div>

      {/* Precio — fila completa. En el editor viejo iba de 8rem al lado del
          nombre, que es de dónde salió el bug de los 360px. */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`precio-${mode}`}>
          Precio
        </label>
        <Input
          id={`precio-${mode}`}
          className="h-11 md:h-9"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Déjalo vacío si varía"
          disabled={saving}
        />
      </div>

      {/* Sección: se ELIGE de las que ya existen. Teclear queda tras "Otra". */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Sección</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={section === SIN_SECCION && !customOpen}
            disabled={saving}
            onClick={() => {
              setSection(SIN_SECCION)
              setCustomOpen(false)
            }}
          >
            Sin sección
          </Chip>
          {sections.map((s) => (
            <Chip
              key={s}
              active={!customOpen && section === s}
              disabled={saving}
              onClick={() => {
                setSection(s)
                setCustomOpen(false)
              }}
            >
              {s}
            </Chip>
          ))}
          <Chip active={customOpen} disabled={saving} onClick={() => setCustomOpen(true)}>
            + Otra
          </Chip>
        </div>
        {customOpen && (
          <Input
            className="h-11 md:h-9"
            autoFocus
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Nombre de la sección nueva, ej. Postres"
            disabled={saving}
          />
        )}
      </div>

      {/* Descripción — fila completa. */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`desc-${mode}`}>
          Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Textarea
          id={`desc-${mode}`}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isMenu ? 'Ej. Contiene: jamón, piña, asadero' : 'Qué incluye'}
          disabled={saving}
        />
        {/* El menú de mesa parte la descripción en lista cuando reconoce una
            etiqueta (`CORTE_ETIQUETA` en landing/src/lib/menu-de-mesa.ts). La
            ayuda nombra las etiquetas que de verdad funcionan: la versión
            anterior enseñaba "Etiqueta: a, b, c" como si cualquier palabra
            sirviera, y remataba con "si usas Tamaños, ponlo primero" — que era
            una regla del parser filtrada al copy, no algo que el usuario pueda
            deducir. Si se agrega una etiqueta allá, se agrega acá. */}
        {isMenu && (
          <p className="text-muted-foreground text-xs">
            Si el platillo trae varias cosas, escribe <b>Contiene: jamón, piña</b> y en el menú del
            QR se ve como lista. También funciona con Incluye, Sabores, Tamaños y Opciones.
          </p>
        )}
      </div>

      {/* Foto: el thumb es de tamaño fijo pero NO comparte fila con un input,
          sólo con botones que traen su propio texto y pueden envolver. */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          Foto <span className="text-muted-foreground font-normal">(opcional)</span>
        </p>
        <div className="flex items-center gap-3">
          {shownPhoto ? (
            <Image
              src={shownPhoto}
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-lg object-cover"
              unoptimized={previewUrl !== null}
            />
          ) : (
            <div className="text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed">
              <ImagePlus className="size-5" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 md:h-8"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
            >
              {shownPhoto ? 'Cambiar foto' : 'Agregar foto'}
            </Button>
            {shownPhoto && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 md:h-8"
                disabled={saving}
                onClick={clearPhoto}
              >
                <X className="size-4" />
                Quitar
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pickFile(e.target.files)
            // Se limpia para poder volver a elegir el mismo archivo.
            e.target.value = ''
          }}
        />
        {file && (
          <p className="text-muted-foreground text-xs">
            La foto se sube al guardar. Si cancelas, no se sube nada.
          </p>
        )}
      </div>

      {/* Visibilidad: UNA pregunta con tres respuestas excluyentes.
          Va DENTRO del formulario a propósito. Antes vivía en un bloque aparte
          que escribía al tocarse, o sea dos modelos de guardado a 3cm de
          distancia en la misma tarjeta; ahora sale por el mismo botón que el
          resto y no hay nada que explicar sobre cuándo se guarda. */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">¿Quién lo ve?</p>
        <div className="flex flex-wrap gap-1.5">
          {VISIBILITY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={visibility === option.value}
              disabled={saving}
              onClick={() => setVisibility(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        {/* Se definen las dos superficies una vez, en vez de explicar qué hace
            cada combinación de estados. */}
        <p className="text-muted-foreground text-xs">
          El menú del QR es el de la mesa. El perfil es lo que ve quien busca el negocio en la app.
        </p>
      </div>

      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-2.5 text-sm">
          {error}
        </p>
      )}

      {/* Dos botones en columnas iguales: reparten el ancho, no lo reclaman. */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="button" className="h-11 md:h-9" disabled={saving} onClick={submit}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? 'Guardando…' : mode === 'nuevo' ? `Agregar ${word}` : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3 py-1.5 text-sm disabled:opacity-50 ${
        active ? 'bg-primary text-primary-foreground border-transparent' : 'border-input'
      }`}
    >
      {children}
    </button>
  )
}
