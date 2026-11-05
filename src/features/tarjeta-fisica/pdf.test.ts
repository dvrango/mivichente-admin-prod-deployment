import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { urlTarjetaFisica } from '@/features/material-grafico/url-menu'
import { HOJA_ALTO, HOJA_ANCHO, PT_POR_PULGADA, TARJETAS_POR_HOJA } from './geometria'
import { armarHoja } from './pdf'

// PNG de 1 × 1 blanco: las caras reales salen del canvas, aquí basta con que
// pdf-lib tenga algo que embeber.
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
  ),
)

const tokens = Array.from({ length: TARJETAS_POR_HOJA }, (_, i) =>
  `tok${String(i).padStart(2, '0')}_secretoXYZ0123456`.slice(0, 24),
)

describe('PDF de la hoja', () => {
  it('son dos páginas tabloide horizontal: frentes y reversos', async () => {
    const bytes = await armarHoja({
      frentePng: PNG,
      reversoPng: PNG,
      urls: tokens.map(urlTarjetaFisica),
      negocio: 'Mr. Xilaquil',
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    for (const pagina of doc.getPages()) {
      expect(pagina.getWidth()).toBe(HOJA_ANCHO * PT_POR_PULGADA)
      expect(pagina.getHeight()).toBe(HOJA_ALTO * PT_POR_PULGADA)
    }
    expect(doc.getTitle()).toBe('Tarjetas de cliente · Mr. Xilaquil')
  })

  it('ningún token aparece como texto en el archivo', async () => {
    const bytes = await armarHoja({
      frentePng: PNG,
      reversoPng: PNG,
      urls: tokens.map(urlTarjetaFisica),
      negocio: 'Mr. Xilaquil',
    })
    const texto = Buffer.from(bytes).toString('latin1')
    for (const token of tokens) expect(texto).not.toContain(token)
    expect(texto).not.toContain('vichente.com/t/')
  })

  it('no arma una hoja incompleta ni con QR repetidos', async () => {
    const base = { frentePng: PNG, reversoPng: PNG, negocio: 'X' }
    await expect(
      armarHoja({ ...base, urls: tokens.slice(1).map(urlTarjetaFisica) }),
    ).rejects.toThrow()
    const repetidos = [...tokens.slice(1), tokens[1]].map(urlTarjetaFisica)
    await expect(armarHoja({ ...base, urls: repetidos })).rejects.toThrow()
  })
})
