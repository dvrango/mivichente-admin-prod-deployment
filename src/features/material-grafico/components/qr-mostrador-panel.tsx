'use client'

import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { descargarBlob } from '../descargar-archivo'

// Solo el QR, negro sobre blanco, para que el negocio o la hoja de la visita
// (`kwsaq3jdo`) lo monten donde quieran. Se dibuja en el navegador por la misma
// razón que la etiqueta del menú: en Vercel no hay con qué renderizar imágenes.
const LADO = 1024
// Mismo nivel y zona de silencio que la etiqueta del menú (`etiqueta-menu.ts`):
// el papel del mostrador se maltrata igual que el de la mesa.
const QR_NIVEL = 'Q' as const
const QR_QUIET = 4

type Props = {
  /** URL exacta que codifica el QR. Ya viene armada por quien llama. */
  url: string
  /** Nombre del PNG sin extensión. */
  archivo: string
}

export function QrMostradorPanel({ url, archivo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [error, setError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelado = false
    setEstado('cargando')
    QRCode.toCanvas(canvas, url, {
      errorCorrectionLevel: QR_NIVEL,
      margin: QR_QUIET,
      width: LADO,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => {
        // `toCanvas` le pone `style.width/height` en px al canvas, y ese estilo
        // en línea le gana a `w-full h-auto`: el QR de 1024 px se salía de la
        // tarjeta. Se quita para que mande la clase.
        canvas.style.removeProperty('width')
        canvas.style.removeProperty('height')
        if (!cancelado) setEstado('listo')
      })
      .catch((e: Error) => {
        if (cancelado) return
        setError(e.message)
        setEstado('error')
      })
    return () => {
      cancelado = true
    }
  }, [url])

  const descargar = useCallback(() => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) descargarBlob(blob, `${archivo}.png`)
    }, 'image/png')
  }, [archivo])

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-56 overflow-hidden rounded-lg border bg-white">
        {/* El canvas mide 1024 px para imprimir; aquí solo se ve en chico. */}
        <canvas ref={canvasRef} className="block h-auto w-full" />
      </div>
      <p className="text-muted-foreground text-xs">
        Apunta a <code className="bg-muted rounded px-1.5 py-0.5 break-all">{url}</code>
      </p>
      {estado === 'error' && (
        <p className="text-destructive text-sm">No se pudo generar el QR: {error}</p>
      )}
      <Button type="button" onClick={descargar} disabled={estado !== 'listo'} className="w-full">
        {estado === 'cargando' ? 'Generando…' : 'Descargar QR'}
      </Button>
    </div>
  )
}
