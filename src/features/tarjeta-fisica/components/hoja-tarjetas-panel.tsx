'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { descargarBlob } from '@/features/material-grafico/descargar-archivo'
import { cargarFuente, cargarImagen } from '@/features/material-grafico/tarjeta-negocio'
import { urlTarjetaFisica } from '@/features/material-grafico/url-menu'
import { crearHojaTarjetas } from '../actions'
import { dibujarFrente, dibujarReverso, tamCanvas } from '../caras'
import { PORTADA_MIN_PX, PPP } from '../diseno'
import { TARJETAS_POR_HOJA } from '../geometria'
import { armarHoja } from '../pdf'
import { matrizQr } from '../qr'

type Props = {
  businessId: string
  slug: string
  nombre: string
  portadaUrl: string | null
}

const ISOTIPO = '/brand/vichente-isotipo.png'
/** La vista previa no necesita 600 ppp; se ve igual y pinta más rápido. */
const PPP_VISTA = 300
/** QR de muestra para la vista previa. No es un token: abrirlo no lleva a
 *  ninguna tarjeta, y verlo no crea nada en la DB. */
const URL_EJEMPLO = urlTarjetaFisica('ejemplo')

type Recursos = { portada: HTMLImageElement; isotipo: HTMLImageElement }

type Estado =
  | { fase: 'cargando' }
  | { fase: 'sin-portada' }
  | { fase: 'error-carga'; error: string }
  | { fase: 'listo' }
  | { fase: 'preparando' }
  | { fase: 'creando' }
  | { fase: 'armando' }
  | { fase: 'descargado' }
  | { fase: 'error'; error: string; tarjetasCreadas: boolean }

function canvasDe(ppp: number) {
  const canvas = document.createElement('canvas')
  const { ancho, alto } = tamCanvas(ppp)
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no soporta canvas 2D')
  return { canvas, ctx }
}

function pngDe(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // `toBlob` truena con SecurityError si la portada se dibujó sin CORS.
    try {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('No se pudo exportar la cara de la tarjeta.'))
        blob
          .arrayBuffer()
          .then((buf) => resolve(new Uint8Array(buf)))
          .catch(reject)
      }, 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

function marcaDeTiempo(fecha: Date) {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}-${dos(fecha.getHours())}${dos(fecha.getMinutes())}`
}

export function HojaTarjetasPanel({ businessId, slug, nombre, portadaUrl }: Props) {
  const frenteRef = useRef<HTMLCanvasElement>(null)
  const reversoRef = useRef<HTMLCanvasElement>(null)
  const recursosRef = useRef<Recursos | null>(null)
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [portadaChica, setPortadaChica] = useState<number | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  // Vista previa: carga todo lo que el PDF va a necesitar y lo dibuja. Si algo
  // falla aquí, el botón de generar no aparece y no se crea ninguna tarjeta.
  useEffect(() => {
    let cancelado = false
    async function preparar() {
      if (!portadaUrl) {
        setEstado({ fase: 'sin-portada' })
        return
      }
      try {
        await cargarFuente()
        await Promise.all(
          [500, 600, 800].map((peso) => document.fonts.load(`${peso} 100px Outfit`)),
        )
        const [isotipo, portada] = await Promise.all([
          cargarImagen(ISOTIPO),
          cargarImagen(portadaUrl, true),
        ])
        if (cancelado) return
        recursosRef.current = { isotipo, portada }
        const lado = Math.min(portada.naturalWidth, portada.naturalHeight)
        setPortadaChica(lado < PORTADA_MIN_PX ? lado : null)

        for (const [ref, dibujar] of [
          [
            frenteRef,
            (ctx: CanvasRenderingContext2D) => dibujarFrente(ctx, { portada, nombre }, PPP_VISTA),
          ],
          [
            reversoRef,
            (ctx: CanvasRenderingContext2D) =>
              dibujarReverso(ctx, { isotipo, qr: matrizQr(URL_EJEMPLO) }, PPP_VISTA),
          ],
        ] as const) {
          const canvas = ref.current
          if (!canvas) return
          const { ancho, alto } = tamCanvas(PPP_VISTA)
          canvas.width = ancho
          canvas.height = alto
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('El navegador no soporta canvas 2D')
          dibujar(ctx)
        }
        setEstado({ fase: 'listo' })
      } catch (e) {
        if (!cancelado) setEstado({ fase: 'error-carga', error: (e as Error).message })
      }
    }
    preparar()
    return () => {
      cancelado = true
    }
  }, [portadaUrl, nombre])

  const generar = useCallback(async () => {
    const recursos = recursosRef.current
    if (!recursos) return

    // 1. Las caras se rasterizan ANTES de crear tokens: si el navegador no puede
    //    exportarlas, se sabe sin haber escrito nada en la DB.
    setEstado({ fase: 'preparando' })
    let frentePng: Uint8Array
    let reversoPng: Uint8Array
    try {
      const frente = canvasDe(PPP)
      dibujarFrente(frente.ctx, { portada: recursos.portada, nombre }, PPP)
      const reverso = canvasDe(PPP)
      dibujarReverso(reverso.ctx, { isotipo: recursos.isotipo }, PPP)
      ;[frentePng, reversoPng] = await Promise.all([pngDe(frente.canvas), pngDe(reverso.canvas)])
    } catch (e) {
      setEstado({ fase: 'error', error: (e as Error).message, tarjetasCreadas: false })
      return
    }

    // 2. La única escritura: crea las físicas de la hoja.
    setEstado({ fase: 'creando' })
    let tokens: string[]
    try {
      const resultado = await crearHojaTarjetas(businessId)
      if (!resultado.ok) {
        setEstado({ fase: 'error', error: resultado.error, tarjetasCreadas: resultado.creadas })
        return
      }
      tokens = resultado.tokens
    } catch (e) {
      // No sabemos si la DB alcanzó a crearlas: se trata como si sí.
      setEstado({ fase: 'error', error: (e as Error).message, tarjetasCreadas: true })
      return
    }

    // 3. Armar y bajar el PDF. Si falla, las tarjetas ya existen, pero sin
    //    imprimir no sirven para nada: se genera otra hoja (decisión del
    //    usuario, 2026-11-05). No se guardan los tokens para reintentar.
    setEstado({ fase: 'armando' })
    try {
      const pdf = await armarHoja({
        frentePng,
        reversoPng,
        urls: tokens.map(urlTarjetaFisica),
        negocio: nombre,
      })
      descargarBlob(
        new Blob([pdf as BlobPart], { type: 'application/pdf' }),
        `vichente-tarjetas-${slug}-${marcaDeTiempo(new Date())}.pdf`,
      )
      setEstado({ fase: 'descargado' })
    } catch (e) {
      setEstado({ fase: 'error', error: (e as Error).message, tarjetasCreadas: true })
    }
  }, [businessId, nombre, slug])

  const ocupado =
    estado.fase === 'preparando' || estado.fase === 'creando' || estado.fase === 'armando'
  const puedeGenerar =
    estado.fase === 'listo' || estado.fase === 'descargado' || estado.fase === 'error'

  return (
    <div className="space-y-6">
      {estado.fase === 'sin-portada' && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          <p className="font-medium">Este negocio no tiene portada.</p>
          <p className="mt-1">
            El frente de la tarjeta usa la portada como logo. Súbela en Editar negocio → Fotos (la
            primera es la portada) y vuelve a abrir esta página.
          </p>
        </div>
      )}

      {estado.fase === 'error-carga' && (
        <p className="text-destructive text-sm">
          No se pudo preparar la vista previa: {estado.error}
        </p>
      )}

      {estado.fase !== 'sin-portada' && (
        <div className="grid gap-6 md:grid-cols-2">
          <figure className="space-y-2">
            <div className="bg-muted rounded-lg border p-4">
              <canvas
                ref={frenteRef}
                className="mx-auto block h-auto w-full max-w-md rounded-sm shadow-sm"
                aria-label="Vista previa del frente de la tarjeta"
              />
            </div>
            <figcaption className="text-muted-foreground text-xs">
              Frente. Es igual en las {TARJETAS_POR_HOJA} tarjetas de la hoja.
            </figcaption>
          </figure>
          <figure className="space-y-2">
            <div className="bg-muted rounded-lg border p-4">
              <canvas
                ref={reversoRef}
                className="mx-auto block h-auto w-full max-w-md rounded-sm shadow-sm"
                aria-label="Vista previa del reverso de la tarjeta"
              />
            </div>
            <figcaption className="text-muted-foreground text-xs">
              Reverso con un QR de ejemplo. En el PDF cada tarjeta lleva el suyo.
            </figcaption>
          </figure>
        </div>
      )}

      {portadaChica !== null && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          La portada mide {portadaChica} px de lado. Impresa a 1.5 pulgadas puede salir pixelada; lo
          ideal es al menos {PORTADA_MIN_PX} px.
        </p>
      )}

      {estado.fase === 'error' && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          <p className="font-medium">No se pudo generar la hoja: {estado.error}</p>
          <p className="mt-1">
            {estado.tarjetasCreadas
              ? 'Puede que las tarjetas de este intento ya existan en la base de datos, pero como no se imprimieron no sirven para nada. Genera otra hoja.'
              : 'No se creó ninguna tarjeta. Puedes volver a intentarlo.'}
          </p>
        </div>
      )}

      {estado.fase === 'descargado' && (
        <p className="text-sm text-green-700">
          Listo: se descargó el PDF con {TARJETAS_POR_HOJA} tarjetas. Mándalo a imprimir una sola
          vez.
        </p>
      )}

      {estado.fase !== 'sin-portada' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => setConfirmar(true)}
            disabled={!puedeGenerar || ocupado}
          >
            {estado.fase === 'cargando'
              ? 'Preparando vista previa…'
              : ocupado
                ? 'Generando hoja…'
                : `Generar hoja de ${TARJETAS_POR_HOJA} tarjetas (PDF)`}
          </Button>
          <span className="text-muted-foreground text-xs">
            Tabloide 11 × 17&quot; · frente y reverso · con marcas de corte
          </span>
        </div>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Generar {TARJETAS_POR_HOJA} tarjetas nuevas?</AlertDialogTitle>
            <AlertDialogDescription>
              Se crean {TARJETAS_POR_HOJA} tarjetas de {nombre} en producción, cada una con su QR, y
              no se pueden borrar. Revisa antes que la portada sea el logo del negocio. Manda el PDF
              a imprimir una sola vez: dos copias de la misma hoja dejarían tarjetas con el mismo
              QR.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmar(false)
                void generar()
              }}
            >
              Generar y descargar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
