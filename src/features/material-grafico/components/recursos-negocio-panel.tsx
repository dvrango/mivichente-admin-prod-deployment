'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { descargarImagen, nombreBase } from '../descargar-archivo'

export type Recurso = {
  /** La URL no sirve de key: dos platillos pueden compartir foto. */
  id: string
  url: string
  /** Lo que se lee bajo la miniatura y da nombre al archivo. */
  etiqueta: string
  portada?: boolean
}

type Props = {
  slug: string
  titulo: string
  recursos: Recurso[]
  /** Qué hacer cuando el grupo está vacío. */
  vacio: string
}

type Estado = 'listo' | 'bajando' | 'fallo'

export function RecursosNegocioPanel({ slug, titulo, recursos, vacio }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium">
        {titulo}{' '}
        <span className="text-muted-foreground text-sm font-normal">({recursos.length})</span>
      </h3>

      {recursos.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{vacio}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {recursos.map((r) => (
            <RecursoItem key={r.id} slug={slug} recurso={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RecursoItem({ slug, recurso }: { slug: string; recurso: Recurso }) {
  const [estado, setEstado] = useState<Estado>('listo')

  async function descargar() {
    setEstado('bajando')
    const ok = await descargarImagen(recurso.url, nombreBase(slug, recurso.etiqueta))
    setEstado(ok ? 'listo' : 'fallo')
  }

  return (
    <li className="flex flex-col gap-2">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg border">
        <Image
          src={recurso.url}
          alt={recurso.etiqueta}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
          unoptimized
        />
        {recurso.portada && <Badge className="absolute top-2 left-2 text-[10px]">Portada</Badge>}
      </div>
      <p className="line-clamp-2 text-xs" title={recurso.etiqueta}>
        {recurso.etiqueta}
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        // Mismo alto mínimo que los toques del modo campo: Sandra la usa desde el celular.
        className="min-h-11 sm:min-h-0"
        onClick={descargar}
        disabled={estado === 'bajando'}
      >
        {estado === 'bajando' ? 'Descargando…' : 'Descargar'}
      </Button>
      {/* El host no dejó bajarla con fetch (sin CORS o caído). Abrirla en otra
          pestaña sí funciona, y de ahí se guarda a mano. */}
      {estado === 'fallo' && (
        <p className="text-destructive text-xs">
          No se pudo descargar.{' '}
          <a href={recurso.url} target="_blank" rel="noopener noreferrer" className="underline">
            Ábrela aquí
          </a>{' '}
          y guárdala con «Guardar imagen».
        </p>
      )}
    </li>
  )
}
