'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ALTO, ANCHO, cargarFuente, cargarImagen, dibujarEtiqueta } from '../etiqueta-menu'

type Props = {
  nombre: string
  slug: string
  url: string
}

const ISOTIPO = '/brand/vichente-isotipo.png'

export function EtiquetaMenuPanel({ nombre, slug, url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelado = false

    async function pintar() {
      try {
        // La fuente se espera SIEMPRE antes de dibujar: si el canvas pinta con
        // la fuente del sistema, la pieza sale con otra letra y no hay aviso.
        await cargarFuente()
        await document.fonts.load(`800 100px Outfit`)
        const isotipo = await cargarImagen(ISOTIPO)
        if (cancelado) return

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = ANCHO
        canvas.height = ALTO
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('El navegador no soporta canvas 2D')

        dibujarEtiqueta(ctx, isotipo, { url })
        setEstado('listo')
      } catch (e) {
        if (cancelado) return
        setError((e as Error).message)
        setEstado('error')
      }
    }

    pintar()
    return () => {
      cancelado = true
    }
  }, [url])

  const descargar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `vichente-etiqueta-menu-${slug}.png`
      a.click()
      URL.revokeObjectURL(href)
    }, 'image/png')
  }, [slug])

  return (
    <div className="space-y-4">
      {/* El fondo a cuadros deja ver que el PNG sale transparente: es lo que
          permite montar la etiqueta sobre la foto del negocio sin recuadro. */}
      <div
        className="overflow-hidden rounded-lg border p-4"
        style={{
          backgroundImage:
            'linear-gradient(45deg,#e5e5e5 25%,transparent 25%,transparent 75%,#e5e5e5 75%),linear-gradient(45deg,#e5e5e5 25%,transparent 25%,transparent 75%,#e5e5e5 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0,10px 10px',
        }}
      >
        <canvas ref={canvasRef} className="block h-auto w-full" />
      </div>

      {estado === 'error' && (
        <p className="text-destructive text-sm">No se pudo generar la etiqueta: {error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={descargar} disabled={estado !== 'listo'}>
          {estado === 'cargando' ? 'Generando…' : 'Descargar PNG'}
        </Button>
        <span className="text-muted-foreground text-xs">
          {ANCHO} × {ALTO} px · fondo transparente · para {nombre}
        </span>
      </div>
    </div>
  )
}
