'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ALTO,
  ANCHO,
  cargarFuente,
  cargarImagen,
  dibujarTarjetaNegocio,
  type DatosTarjeta,
} from '../tarjeta-negocio'

type Props = DatosTarjeta & {
  slug: string
  fotoUrl: string | null
}

const ISOTIPO = '/brand/vichente-isotipo.png'
const SKYLINE = '/brand/skyline-strip.png'

export function TarjetaNegocioPanel({ slug, fotoUrl, ...datos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [error, setError] = useState('')
  const [sinFoto, setSinFoto] = useState(false)

  useEffect(() => {
    let cancelado = false

    async function pintar() {
      try {
        await cargarFuente()
        await document.fonts.load('800 100px Outfit')

        const [isotipo, skyline] = await Promise.all([cargarImagen(ISOTIPO), cargarImagen(SKYLINE)])
        // La foto es de otro origen (Supabase Storage) y puede faltar o fallar.
        // Si falla, la pieza sale con el isotipo igual que la tarjeta web — no
        // tiene por qué reventar el render entero.
        const foto = fotoUrl ? await cargarImagen(fotoUrl, true).catch(() => null) : null
        if (cancelado) return
        setSinFoto(!foto)

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = ANCHO
        canvas.height = ALTO
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('El navegador no soporta canvas 2D')

        dibujarTarjetaNegocio(ctx, { isotipo, skyline, foto }, datos)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoUrl, datos.nombre, datos.categoria, datos.verificado])

  const descargar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `vichente-tarjeta-${slug}.png`
      a.click()
      URL.revokeObjectURL(href)
    }, 'image/png')
  }, [slug])

  return (
    <div className="space-y-4">
      <div className="bg-muted overflow-hidden rounded-lg border p-4">
        <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-sm" />
      </div>

      {estado === 'error' && (
        <p className="text-destructive text-sm">No se pudo generar la tarjeta: {error}</p>
      )}

      {sinFoto && estado === 'listo' && (
        <p className="text-muted-foreground text-sm">
          Sin foto de portada: la tarjeta salió con el isotipo de Vichente. Súbele una foto al
          negocio para que la comparta con su propia imagen.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={descargar} disabled={estado !== 'listo'}>
          {estado === 'cargando' ? 'Generando…' : 'Descargar PNG'}
        </Button>
        <span className="text-muted-foreground text-xs">
          {ANCHO} × {ALTO} px · post de feed (4:5)
        </span>
      </div>
    </div>
  )
}
