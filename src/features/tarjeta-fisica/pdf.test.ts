import { PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib'
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

/** Todo lo que un lector del PDF podría sacar como texto: los metadatos
 *  decodificados y cada stream descomprimido. */
async function textoLegible(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const partes = [
    doc.getTitle(),
    doc.getSubject(),
    doc.getAuthor(),
    doc.getCreator(),
    doc.getProducer(),
    doc.getKeywords(),
  ].filter((v): v is string => Boolean(v))
  for (const [, objeto] of doc.context.enumerateIndirectObjects()) {
    if (objeto instanceof PDFRawStream) {
      try {
        partes.push(Buffer.from(decodePDFRawStream(objeto).decode()).toString('latin1'))
      } catch {
        partes.push(Buffer.from(objeto.getContents()).toString('latin1'))
      }
    } else {
      partes.push(objeto.toString())
    }
  }
  return partes.join('\n')
}

/** El texto de una página puede ir literal o en hex (`<74657874> Tj`). */
function contiene(texto: string, buscado: string): boolean {
  const hex = Buffer.from(buscado, 'latin1').toString('hex')
  const plano = texto.toLowerCase()
  return texto.includes(buscado) || plano.includes(hex)
}

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

  it('la búsqueda de abajo sí encuentra un token escrito en el PDF', async () => {
    // Control: sin esto, el test siguiente podría pasar sin mirar nada, porque
    // pdf-lib comprime los content streams y guarda los metadatos en hex.
    const doc = await PDFDocument.create()
    doc.setTitle(`titulo ${tokens[0]}`)
    const pagina = doc.addPage()
    pagina.drawText(tokens[1], { font: await doc.embedFont(StandardFonts.Helvetica) })
    const texto = await textoLegible(await doc.save())
    expect(contiene(texto, tokens[0])).toBe(true)
    expect(contiene(texto, tokens[1])).toBe(true)
  })

  it('ningún token aparece como texto en el archivo', async () => {
    const bytes = await armarHoja({
      frentePng: PNG,
      reversoPng: PNG,
      urls: tokens.map(urlTarjetaFisica),
      negocio: 'Mr. Xilaquil',
    })
    const texto = await textoLegible(bytes)
    for (const token of tokens) expect(contiene(texto, token)).toBe(false)
    expect(contiene(texto, 'vichente.com/t/')).toBe(false)
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
