import { PDFDocument, degrees, rgb, type PDFPage } from 'pdf-lib'
import { cajaQr } from './diseno'
import {
  GIRO_REVERSO,
  HOJA_ALTO,
  HOJA_ANCHO,
  MARCA_GROSOR_PT,
  PT_POR_PULGADA,
  TARJETA_ALTO,
  TARJETA_ANCHO,
  TARJETAS_POR_HOJA,
  aPagina,
  celdas,
  marcasDeCorte,
  type Celda,
} from './geometria'
import { matrizQr } from './qr'

// Arma el PDF de la hoja: página 1 con los 20 frentes y página 2 con los 20
// reversos, en la misma rejilla. No toca el DOM: recibe las dos caras ya
// rasterizadas como PNG y las URLs de los QR, así que corre igual en Vitest.
//
// Cada cara fija se embebe UNA vez y se dibuja 20 veces (pdf-lib reusa el mismo
// objeto de imagen). El QR va encima del reverso como vector, para que salga
// nítido a cualquier resolución y para no meter 20 imágenes casi iguales.

export type EntradaHoja = {
  frentePng: Uint8Array
  reversoPng: Uint8Array
  /** Una URL por tarjeta, en el orden de la hoja. */
  urls: string[]
  /** Nombre del negocio, para el título del documento. */
  negocio: string
}

const NEGRO = rgb(0, 0, 0)
const pt = (pulgadas: number) => pulgadas * PT_POR_PULGADA

export async function armarHoja({
  frentePng,
  reversoPng,
  urls,
  negocio,
}: EntradaHoja): Promise<Uint8Array> {
  if (urls.length !== TARJETAS_POR_HOJA) {
    throw new Error(`La hoja lleva ${TARJETAS_POR_HOJA} tarjetas y llegaron ${urls.length}.`)
  }
  if (new Set(urls).size !== urls.length) {
    throw new Error('Hay dos tarjetas con el mismo QR.')
  }

  const doc = await PDFDocument.create()
  // Los metadatos van sin tokens a propósito: el token es secreto al portador.
  doc.setTitle(`Tarjetas de cliente · ${negocio}`)
  doc.setCreator('Vichente Admin')
  doc.setProducer('Vichente Admin')

  const [frente, reverso] = await Promise.all([doc.embedPng(frentePng), doc.embedPng(reversoPng)])
  const posiciones = celdas()
  const tamPagina: [number, number] = [pt(HOJA_ANCHO), pt(HOJA_ALTO)]

  const paginaFrentes = doc.addPage(tamPagina)
  for (const celda of posiciones) dibujarCara(paginaFrentes, frente, celda, 0)
  dibujarMarcas(paginaFrentes)

  const paginaReversos = doc.addPage(tamPagina)
  posiciones.forEach((celda, i) => {
    dibujarCara(paginaReversos, reverso, celda, GIRO_REVERSO)
    dibujarQr(paginaReversos, urls[i], celda, GIRO_REVERSO)
  })
  dibujarMarcas(paginaReversos)

  return doc.save()
}

function dibujarCara(
  pagina: PDFPage,
  imagen: Awaited<ReturnType<PDFDocument['embedPng']>>,
  celda: Celda,
  giro: 0 | 180,
) {
  // pdf-lib rota alrededor del origen de la imagen, que es su esquina de abajo
  // a la izquierda: el punto (0, alto) de la tarjeta.
  const origen = aPagina(celda, giro, 0, TARJETA_ALTO)
  pagina.drawImage(imagen, {
    x: origen.x,
    y: origen.y,
    width: pt(TARJETA_ANCHO),
    height: pt(TARJETA_ALTO),
    rotate: degrees(giro),
  })
}

function dibujarQr(pagina: PDFPage, url: string, celda: Celda, giro: 0 | 180) {
  const caja = cajaQr()
  const qr = matrizQr(url)
  // drawSvgPath pone el origen del path en (x, y) con el eje Y hacia abajo,
  // igual que la tarjeta, así que el origen es la esquina de arriba a la
  // izquierda del QR.
  const origen = aPagina(celda, giro, caja.x, caja.y)
  pagina.drawSvgPath(qr.path, {
    x: origen.x,
    y: origen.y,
    scale: pt(caja.lado) / qr.lado,
    rotate: degrees(giro),
    color: NEGRO,
  })
}

function dibujarMarcas(pagina: PDFPage) {
  for (const linea of marcasDeCorte()) {
    pagina.drawLine({
      start: { x: linea.x1, y: linea.y1 },
      end: { x: linea.x2, y: linea.y2 },
      thickness: MARCA_GROSOR_PT,
      color: NEGRO,
    })
  }
}
