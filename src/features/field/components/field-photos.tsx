'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, ImagePlus, Loader2, RotateCcw, ScrollText, Star, X } from 'lucide-react'
import {
  PHOTO_KIND_LABELS,
  PHOTO_TARGET_COUNT,
  SELECTABLE_PHOTO_KINDS,
  type PhotoKind,
} from '../constants'
import { addFieldPhoto, removeFieldPhoto, setFieldCoverPhoto, setFieldPhotoKind } from '../actions'
import { uploadFieldPhoto } from '../lib/upload-photo'
import type { FieldPhoto } from '../queries'

// `state`, no `kind`: el kind de aquí es el de la FOTO (fachada/menu/…), y tener
// dos cosas llamadas kind en el mismo archivo se presta a confusión.
type Tile =
  | { state: 'saved'; photo: FieldPhoto }
  | { state: 'pending'; localId: string; previewUrl: string; file: File; error: string | null }

export function FieldPhotos({
  businessId,
  initialPhotos,
  onCountChange,
}: {
  businessId: string
  initialPhotos: FieldPhoto[]
  onCountChange: (count: number) => void
}) {
  const [tiles, setTiles] = useState<Tile[]>(
    initialPhotos.map((photo) => ({ state: 'saved' as const, photo })),
  )
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const objectUrls = useRef<string[]>([])
  // Qué se está por fotografiar. Se fija al tocar el botón y lo lee el onChange
  // del input — así la foto nace ya clasificada y no hay que acordarse después.
  const nextKind = useRef<PhotoKind>('otro')

  const savedCount = tiles.filter((t) => t.state === 'saved').length
  const hasMenu = tiles.some((t) => t.state === 'saved' && t.photo.kind === 'menu')

  useEffect(() => {
    onCountChange(savedCount)
  }, [savedCount, onCountChange])

  // Los object URLs de los previews locales se revocan al desmontar.
  useEffect(() => {
    const urls = objectUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  /**
   * La captura NUNCA se bloquea: el tile aparece de inmediato con el preview
   * local, y la compresión + subida corren detrás. Si falla, el tile muestra el
   * motivo y ofrece reintento en vez de tirar un error global.
   */
  async function processFile(file: File, localId: string, previewUrl: string, kind: PhotoKind) {
    const fail = (message: string) =>
      setTiles((prev) =>
        prev.map((t) =>
          t.state === 'pending' && t.localId === localId ? { ...t, error: message } : t,
        ),
      )

    const uploaded = await uploadFieldPhoto(businessId, file)
    if (uploaded.error || !uploaded.url) {
      fail(uploaded.error ?? 'No se pudo subir la foto.')
      return
    }

    const result = await addFieldPhoto(businessId, { url: uploaded.url, kind })
    if (result.error || !result.photo) {
      fail(result.error ?? 'No se pudo guardar la foto.')
      return
    }

    URL.revokeObjectURL(previewUrl)
    objectUrls.current = objectUrls.current.filter((u) => u !== previewUrl)
    setTiles((prev) =>
      prev.map((t) =>
        t.state === 'pending' && t.localId === localId
          ? { state: 'saved' as const, photo: result.photo! }
          : t,
      ),
    )
  }

  function onFiles(files: FileList | null, kind: PhotoKind) {
    if (!files) return
    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      objectUrls.current.push(previewUrl)
      setTiles((prev) => [...prev, { state: 'pending', localId, previewUrl, file, error: null }])
      void processFile(file, localId, previewUrl, kind)
    }
  }

  function shoot(kind: PhotoKind) {
    nextKind.current = kind
    cameraRef.current?.click()
  }

  function retry(tile: Extract<Tile, { state: 'pending' }>) {
    setTiles((prev) =>
      prev.map((t) =>
        t.state === 'pending' && t.localId === tile.localId ? { ...t, error: null } : t,
      ),
    )
    void processFile(tile.file, tile.localId, tile.previewUrl, 'otro')
  }

  async function remove(tile: Tile) {
    if (tile.state === 'pending') {
      URL.revokeObjectURL(tile.previewUrl)
      setTiles((prev) => prev.filter((t) => !(t.state === 'pending' && t.localId === tile.localId)))
      return
    }
    setTiles((prev) => prev.filter((t) => !(t.state === 'saved' && t.photo.id === tile.photo.id)))
    await removeFieldPhoto(businessId, tile.photo.id)
  }

  async function makeCover(photo: FieldPhoto) {
    // Un solo toque, en vez de subir la foto N posiciones con flechas.
    setTiles((prev) => {
      const rest = prev.filter((t) => !(t.state === 'saved' && t.photo.id === photo.id))
      return [{ state: 'saved' as const, photo }, ...rest]
    })
    await setFieldCoverPhoto(businessId, photo.id)
  }

  async function reclassify(photo: FieldPhoto, kind: PhotoKind) {
    const caption = kind === 'otro' ? null : PHOTO_KIND_LABELS[kind]
    setTiles((prev) =>
      prev.map((t) =>
        t.state === 'saved' && t.photo.id === photo.id
          ? { state: 'saved', photo: { ...t.photo, kind, caption } }
          : t,
      ),
    )
    await setFieldPhotoKind(photo.id, kind)
  }

  return (
    <section id="campo-fotos" className="scroll-mt-20 px-4 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Fotos</h2>
        <span
          className={`text-sm ${savedCount >= PHOTO_TARGET_COUNT ? 'text-emerald-600' : 'text-muted-foreground'}`}
        >
          {savedCount}/{PHOTO_TARGET_COUNT}
        </span>
      </div>

      {/* El botón dice QUÉ vas a fotografiar. Clasificar al disparar es un toque
          menos que hacerlo después, y hace imposible que se te olvide. */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => shoot('fachada')}
          className="bg-primary text-primary-foreground flex h-14 items-center justify-center gap-2 rounded-xl font-medium active:translate-y-px"
        >
          <Camera className="size-5" />
          Fachada
        </button>
        <button
          type="button"
          onClick={() => shoot('menu')}
          className={`flex h-14 items-center justify-center gap-2 rounded-xl border font-medium active:translate-y-px ${
            hasMenu ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-input'
          }`}
        >
          <ScrollText className="size-5" />
          Menú
        </button>
        <button
          type="button"
          onClick={() => shoot('producto')}
          className="border-input flex h-14 items-center justify-center gap-2 rounded-xl border font-medium active:translate-y-px"
        >
          <Camera className="size-5" />
          Otra foto
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="border-input flex h-14 items-center justify-center gap-2 rounded-xl border font-medium active:translate-y-px"
        >
          <ImagePlus className="size-5" />
          Galería
        </button>
      </div>

      {/* Dos inputs separados: `capture` y `multiple` chocan — varios navegadores
          ignoran multiple cuando hay capture. Cámara = una foto; galería = varias. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          onFiles(e.target.files, nextKind.current)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          // Desde el carrete no se sabe qué es cada foto: entra como 'otro' y se
          // reclasifica con los chips si hace falta.
          onFiles(e.target.files, 'otro')
          e.target.value = ''
        }}
      />

      {tiles.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {tiles.map((tile, index) => {
            const key = tile.state === 'saved' ? tile.photo.id : tile.localId
            const src = tile.state === 'saved' ? tile.photo.url : tile.previewUrl
            const isCover = tile.state === 'saved' && index === 0

            return (
              <li key={key} className="overflow-hidden rounded-xl border">
                <div className="bg-muted relative aspect-square">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="50vw"
                    unoptimized={tile.state === 'pending'}
                    className="object-cover"
                  />
                  {tile.state === 'pending' && !tile.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="size-6 animate-spin text-white" />
                    </div>
                  )}
                  {tile.state === 'pending' && tile.error && (
                    <button
                      type="button"
                      onClick={() => retry(tile)}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-2 text-center text-white"
                    >
                      <RotateCcw className="size-5" />
                      <span className="text-xs font-medium">Reintentar</span>
                      {/* El motivo real, no sólo "falló": sin esto no hay forma de
                          distinguir un problema de red de uno de permisos. */}
                      <span className="line-clamp-3 text-[10px] leading-tight opacity-80">
                        {tile.error}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(tile)}
                    aria-label="Quitar foto"
                    className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="size-4" />
                  </button>
                  {isCover && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      Portada
                    </span>
                  )}
                </div>

                {tile.state === 'saved' && (
                  <div className="p-2">
                    <div className="-mx-2 flex gap-1 overflow-x-auto px-2 pb-1">
                      {SELECTABLE_PHOTO_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => reclassify(tile.photo, k)}
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                            tile.photo.kind === k
                              ? 'bg-primary text-primary-foreground border-transparent'
                              : 'border-input'
                          }`}
                        >
                          {PHOTO_KIND_LABELS[k]}
                        </button>
                      ))}
                    </div>
                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => makeCover(tile.photo)}
                        className="text-muted-foreground mt-1 flex items-center gap-1 text-xs"
                      >
                        <Star className="size-3.5" />
                        Hacer portada
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
