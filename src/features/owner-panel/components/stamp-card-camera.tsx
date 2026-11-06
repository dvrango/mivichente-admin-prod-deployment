'use client'

import { useEffect, useRef } from 'react'
import styles from './stamp-card.module.css'

// D2 · Cámara. Lee el QR del celular del cliente o de su tarjeta impresa, y
// regresa el texto crudo: decidir si es una tarjeta lo hace `cardTokenFromScan`.
//
// Chrome de Android trae `BarcodeDetector`; Safari de iOS no. Sin él se usa
// `jsqr` sobre cuadros del video, cargado solo en ese caso. `getUserMedia` pide
// contexto seguro (HTTPS o localhost): en `http://192.168…` no existe y sale E6.

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats?: () => Promise<string[]>
}

/** Cada cuánto se intenta leer un cuadro. Más seguido no lee mejor y calienta el celular. */
const SCAN_EVERY_MS = 180
/** jsqr trabaja sobre el cuadro reducido: más rápido y lee igual a distancia de caja. */
const MAX_SIDE = 640

async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code']
    if (!formats.includes('qr_code')) return null
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

export function StampCardCamera({
  onScan,
  onError,
  onCancel,
}: {
  onScan: (text: string) => void
  onError: () => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Los callbacks cambian en cada render del padre; la cámara no debe reiniciarse por eso.
  const handlers = useRef({ onScan, onError })
  useEffect(() => {
    handlers.current = { onScan, onError }
  })

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const stop = () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }

    async function start() {
      const video = videoRef.current
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        handlers.current.onError()
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        if (!stopped) handlers.current.onError()
        return
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // iOS a veces rechaza play() aunque el video ya corre con `muted playsInline`.
      }

      const detector = await nativeDetector()
      let decode: ((canvas: HTMLCanvasElement) => string | null) | null = null
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!detector) {
        const { default: jsQR } = await import('jsqr')
        decode = (c) => {
          if (!ctx) return null
          const img = ctx.getImageData(0, 0, c.width, c.height)
          return (
            jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
          )
        }
      }

      const tick = async () => {
        if (stopped) return
        let text: string | null = null
        try {
          if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            if (detector) {
              const found = await detector.detect(video)
              text = found[0]?.rawValue ?? null
            } else if (decode && ctx) {
              const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
              canvas.width = Math.round(video.videoWidth * scale)
              canvas.height = Math.round(video.videoHeight * scale)
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              text = decode(canvas)
            }
          }
        } catch {
          text = null
        }
        if (stopped) return
        if (text) {
          stop()
          handlers.current.onScan(text)
          return
        }
        timer = setTimeout(tick, SCAN_EVERY_MS)
      }
      tick()
    }

    start()
    return stop
  }, [])

  return (
    <div className={`${styles.screen} ${styles.camera} font-sans`} role="dialog" aria-modal="true">
      <div className={styles.msg}>
        <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">
          Apunta al código de la tarjeta
        </h1>
      </div>
      <div className={styles.viewer}>
        <video ref={videoRef} className={styles.video} muted playsInline aria-hidden />
        <div className={styles.frame} />
      </div>
      <div className={styles.act}>
        <button
          type="button"
          onClick={onCancel}
          className="row-start-2 flex items-center justify-center text-[15px] font-medium text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
