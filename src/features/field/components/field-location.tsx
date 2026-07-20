'use client'

import { useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'

type GpsState = { status: 'idle' | 'locating' | 'error'; message?: string; accuracy?: number }

/**
 * Ubicación. El GPS arma el `maps_url` de un toque, pero NUNCA es el único
 * camino: el input de dirección queda siempre visible porque
 * `navigator.geolocation` falla de más de una forma en la calle.
 *
 * Requiere contexto seguro (https o localhost). Servido por IP de LAN sobre
 * http, `navigator.geolocation` simplemente no existe — de ahí el mensaje
 * explícito en vez de un botón que no hace nada.
 */
export type CapturedLocation = {
  mapsUrl: string
  latitude: number
  longitude: number
  accuracy: number
}

export function FieldLocation({
  address,
  mapsUrl,
  savedAccuracy,
  onAddressChange,
  onAddressBlur,
  onLocation,
}: {
  address: string
  mapsUrl: string
  savedAccuracy: number | null
  onAddressChange: (value: string) => void
  onAddressBlur: () => void
  onLocation: (location: CapturedLocation) => void
}) {
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps({
        status: 'error',
        message: 'El GPS necesita HTTPS. Escribe la dirección o pega el link de Maps.',
      })
      return
    }

    setGps({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        // Se guardan las coordenadas COMO NÚMEROS, no sólo la URL de Maps: son
        // el insumo del mapa embebido y de las rutas, y volver por ellas
        // significaría recorrer el pueblo otra vez.
        onLocation({
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
          latitude,
          longitude,
          accuracy,
        })
        setGps({ status: 'idle', accuracy })
      },
      (error) => {
        setGps({
          status: 'error',
          message:
            error.code === error.PERMISSION_DENIED
              ? 'Permiso de ubicación denegado. Escribe la dirección.'
              : 'No se pudo obtener la ubicación. Intenta afuera del local.',
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <section id="campo-ubicacion" className="scroll-mt-20 border-t px-4 py-5">
      <h2 className="mb-3 font-semibold">Ubicación</h2>

      <button
        type="button"
        onClick={locate}
        disabled={gps.status === 'locating'}
        className="border-input mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl border font-medium active:translate-y-px disabled:opacity-50"
      >
        <MapPin className="size-5" />
        {gps.status === 'locating' ? 'Ubicando…' : 'Usar mi ubicación'}
      </button>

      {mapsUrl && (
        <p className="mb-3 flex items-center gap-2 text-sm">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 underline"
          >
            Ver en Maps
            <ExternalLink className="size-3.5" />
          </a>
          {/* La precisión se muestra para poder detectar y repetir una lectura
              mala tomada dentro de un local de concreto. */}
          {(gps.accuracy ?? savedAccuracy) !== null &&
            (gps.accuracy ?? savedAccuracy) !== undefined && (
              <span className="text-muted-foreground">
                ±{Math.round((gps.accuracy ?? savedAccuracy)!)} m
              </span>
            )}
        </p>
      )}

      {gps.status === 'error' && <p className="mb-3 text-sm text-amber-700">{gps.message}</p>}

      <input
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        onBlur={onAddressBlur}
        placeholder="Calle y número"
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
      />
    </section>
  )
}
