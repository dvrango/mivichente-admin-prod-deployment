import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { urlTarjetaFisica } from '@/features/material-grafico/url-menu'
import { QR_SILENCIO, matrizQr } from './qr'

// Token con la forma real: 18 bytes en base64url son 24 caracteres.
const TOKEN = 'Ab3_k9-ZqW0xYt7LmN2pR5sV'

/** Rasteriza la matriz a píxeles RGBA, como la vería la cámara. */
function rasterizar(lado: number, oscuro: (f: number, c: number) => boolean, px = 8) {
  const ancho = lado * px
  const datos = new Uint8ClampedArray(ancho * ancho * 4)
  for (let y = 0; y < ancho; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = oscuro(Math.floor(y / px), Math.floor(x / px)) ? 0 : 255
      const i = (y * ancho + x) * 4
      datos[i] = v
      datos[i + 1] = v
      datos[i + 2] = v
      datos[i + 3] = 255
    }
  }
  return { datos, ancho }
}

/** Rasteriza el path SVG: así se comprueba lo que de verdad va al PDF. */
function oscuroDesdePath(path: string, lado: number) {
  const celdas = new Set<string>()
  for (const m of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    const [x, y, largo] = [Number(m[1]), Number(m[2]), Number(m[3])]
    for (let i = 0; i < largo; i++) celdas.add(`${y},${x + i}`)
  }
  expect(path.replace(/M\d+ \d+h(\d+)v1h-\1z/g, '')).toBe('')
  return (f: number, c: number) => f < lado && c < lado && celdas.has(`${f},${c}`)
}

describe('URL de la tarjeta física', () => {
  it('es vichente.com/t/{token}, sin slug ni src', () => {
    expect(urlTarjetaFisica(TOKEN)).toBe(`https://vichente.com/t/${TOKEN}`)
  })
})

describe('QR de la tarjeta física', () => {
  const url = urlTarjetaFisica(TOKEN)
  const qr = matrizQr(url)

  it('lleva la zona de silencio de 4 módulos en blanco', () => {
    for (let i = 0; i < qr.lado; i++) {
      for (let j = 0; j < QR_SILENCIO; j++) {
        expect(qr.oscuro(i, j)).toBe(false)
        expect(qr.oscuro(j, i)).toBe(false)
        expect(qr.oscuro(i, qr.lado - 1 - j)).toBe(false)
        expect(qr.oscuro(qr.lado - 1 - j, i)).toBe(false)
      }
    }
  })

  it('el path del PDF cubre exactamente los módulos oscuros', () => {
    const desdePath = oscuroDesdePath(qr.path, qr.lado)
    for (let f = 0; f < qr.lado; f++) {
      for (let c = 0; c < qr.lado; c++) expect(desdePath(f, c)).toBe(qr.oscuro(f, c))
    }
  })

  it('el path del PDF se lee y devuelve la URL exacta', () => {
    const { datos, ancho } = rasterizar(qr.lado, oscuroDesdePath(qr.path, qr.lado))
    expect(jsQR(datos, ancho, ancho)?.data).toBe(url)
  })
})
