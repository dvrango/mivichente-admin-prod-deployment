/**
 * Coordenadas a partir de un link de Google Maps.
 *
 * Sirve para rescatar lat/lng de los negocios que ya traen `maps_url` (scraping
 * o pegado a mano) sin tener que ir al lugar con el celular. Es puro parseo de
 * texto: NO resuelve links cortos (`maps.app.goo.gl/…`, `goo.gl/maps/…`), que no
 * llevan las coordenadas dentro — para esos hay que abrirlos y copiar la URL
 * larga.
 *
 * Formatos que reconoce:
 *   .../maps/search/?api=1&query=23.7,-103.9     (el que arma el modo campo)
 *   .../maps/place/X/@23.7,-103.9,17z/...        (el que da el navegador)
 *   ...!3d23.7!4d-103.9                          (data= de los links de place)
 *   23.7, -103.9                                 (pegar coordenadas a secas)
 */
export type Coordinates = { latitude: number; longitude: number }

const PAIR = String.raw`(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)`

const PATTERNS = [
  new RegExp(String.raw`[?&](?:query|q|ll|center|daddr)=${PAIR}`, 'i'),
  new RegExp(String.raw`@${PAIR}`),
  /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
  new RegExp(String.raw`^\s*${PAIR}\s*$`),
]

function isValid(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    // 0,0 es el Golfo de Guinea: siempre es un parseo fallido, no un negocio.
    !(latitude === 0 && longitude === 0)
  )
}

export function coordinatesFromMapsUrl(raw: string | null | undefined): Coordinates | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  for (const pattern of PATTERNS) {
    const match = value.match(pattern)
    if (!match) continue
    const latitude = Number(match[1])
    const longitude = Number(match[2])
    if (isValid(latitude, longitude)) return { latitude, longitude }
  }

  return null
}
