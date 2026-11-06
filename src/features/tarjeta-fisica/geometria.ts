// Geometría de la hoja de tarjetas físicas (tarea e69q7q4fy). Todo lo que la
// imprenta puede pedir cambiar vive aquí, en constantes, para que ajustar el
// acomodo sea mover un valor y no reescribir el dibujo.
//
// Lo que se sabe de la imprenta (cotizado el 2026-11-04): tabloide 11 × 17",
// 20 tarjetas de 3.5 × 2" por hoja (4 × 5), dos caras, laminada y cortada, con
// marcas de corte. Lo que NO se sabe todavía se decidió así el 2026-11-05 y se
// confirma con la hoja de prueba:
//   - las tarjetas van pegadas, sin medianil, y las marcas van solo en el margen
//     de la hoja, alineadas con cada línea de corte;
//   - cada reverso va en la misma posición y orientación que su frente.
//
// Unidades: el PDF trabaja en puntos (72 por pulgada) con el origen abajo a la
// izquierda. Dentro de una tarjeta se trabaja en pulgadas desde la esquina de
// arriba a la izquierda, como el canvas y el mockup.

export const PT_POR_PULGADA = 72

/** Tarjeta de presentación estándar, en pulgadas. */
export const TARJETA_ANCHO = 3.5
export const TARJETA_ALTO = 2

export const COLUMNAS = 4
export const FILAS = 5
export const TARJETAS_POR_HOJA = COLUMNAS * FILAS

/** Tabloide en horizontal: 4 × 3.5" = 14" solo cabe a lo largo de las 17". */
export const HOJA_ANCHO = 17
export const HOJA_ALTO = 11

/** Separación entre tarjetas. 0 = pegadas: un solo corte separa dos tarjetas.
 *  Si la imprenta pide medianil con una cruz por esquina, se sube aquí y las
 *  marcas pasan a cada esquina de cada tarjeta. */
export const MEDIANIL = 0

/** Marcas de corte: separadas del borde de la rejilla para que la cuchilla no
 *  corte sobre ellas, y cortas para que quepan en el margen de arriba y abajo
 *  (0.5" con las medidas de hoy). */
export const MARCA_SEPARACION = 0.0625
export const MARCA_LARGO = 0.25
export const MARCA_GROSOR_PT = 0.25

/** 0 = el reverso en la misma orientación que su frente; 180 = de cabeza. Lo
 *  decide cómo voltea la hoja la imprenta (borde largo o corto). */
export const GIRO_REVERSO: 0 | 180 = 0

export type Celda = {
  fila: number
  columna: number
  /** Esquina de arriba a la izquierda de la tarjeta, en puntos de la página. */
  izquierda: number
  arriba: number
}

export type Linea = { x1: number; y1: number; x2: number; y2: number }

const pt = (pulgadas: number) => pulgadas * PT_POR_PULGADA

export function anchoRejilla(): number {
  return COLUMNAS * TARJETA_ANCHO + (COLUMNAS - 1) * MEDIANIL
}

export function altoRejilla(): number {
  return FILAS * TARJETA_ALTO + (FILAS - 1) * MEDIANIL
}

/** Margen alrededor de la rejilla, en pulgadas. La rejilla va centrada: es lo
 *  que hace que el corte coincida en las dos caras con cualquier volteo. */
export function margenes(): { x: number; y: number } {
  return { x: (HOJA_ANCHO - anchoRejilla()) / 2, y: (HOJA_ALTO - altoRejilla()) / 2 }
}

/** Las 20 posiciones de la hoja, de arriba a abajo y de izquierda a derecha. */
export function celdas(): Celda[] {
  const { x, y } = margenes()
  const lista: Celda[] = []
  for (let fila = 0; fila < FILAS; fila++) {
    for (let columna = 0; columna < COLUMNAS; columna++) {
      lista.push({
        fila,
        columna,
        izquierda: pt(x + columna * (TARJETA_ANCHO + MEDIANIL)),
        arriba: pt(HOJA_ALTO - y - fila * (TARJETA_ALTO + MEDIANIL)),
      })
    }
  }
  return lista
}

/**
 * Lleva un punto de la tarjeta (pulgadas desde su esquina de arriba a la
 * izquierda) a la página, aplicando el giro de la cara. Con giro 180 la tarjeta
 * entera rota sobre su centro. Quien dibuja usa el resultado como origen y pasa
 * el mismo giro a pdf-lib, que rota alrededor de ese origen.
 */
export function aPagina(celda: Celda, giro: 0 | 180, u: number, v: number) {
  if (giro === 180) {
    return { x: celda.izquierda + pt(TARJETA_ANCHO - u), y: celda.arriba - pt(TARJETA_ALTO - v) }
  }
  return { x: celda.izquierda + pt(u), y: celda.arriba - pt(v) }
}

/** Las marcas de corte, en puntos de la página. */
export function marcasDeCorte(): Linea[] {
  return MEDIANIL > 0 ? marcasPorTarjeta() : marcasEnMargen()
}

/** Tarjetas pegadas: un tramo corto afuera de la rejilla en cada extremo de
 *  cada línea de corte. Adentro de la rejilla no se imprime nada. */
function marcasEnMargen(): Linea[] {
  const { x, y } = margenes()
  const izq = x
  const der = x + anchoRejilla()
  const sup = HOJA_ALTO - y
  const inf = y
  const lineas: Linea[] = []

  for (let c = 0; c <= COLUMNAS; c++) {
    const cx = pt(x + c * TARJETA_ANCHO)
    lineas.push({
      x1: cx,
      y1: pt(sup + MARCA_SEPARACION),
      x2: cx,
      y2: pt(sup + MARCA_SEPARACION + MARCA_LARGO),
    })
    lineas.push({
      x1: cx,
      y1: pt(inf - MARCA_SEPARACION),
      x2: cx,
      y2: pt(inf - MARCA_SEPARACION - MARCA_LARGO),
    })
  }
  for (let f = 0; f <= FILAS; f++) {
    const cy = pt(sup - f * TARJETA_ALTO)
    lineas.push({
      x1: pt(izq - MARCA_SEPARACION),
      y1: cy,
      x2: pt(izq - MARCA_SEPARACION - MARCA_LARGO),
      y2: cy,
    })
    lineas.push({
      x1: pt(der + MARCA_SEPARACION),
      y1: cy,
      x2: pt(der + MARCA_SEPARACION + MARCA_LARGO),
      y2: cy,
    })
  }
  return lineas
}

/** Con medianil: en cada esquina de cada tarjeta, dos tramos que salen hacia el
 *  medianil, sin entrar a la tarjeta. El largo se acota al medianil para no
 *  invadir la tarjeta de al lado. */
function marcasPorTarjeta(): Linea[] {
  const largo = Math.min(MARCA_LARGO, Math.max(MEDIANIL - MARCA_SEPARACION, 0))
  const lineas: Linea[] = []
  for (const celda of celdas()) {
    const x0 = celda.izquierda
    const x1 = celda.izquierda + pt(TARJETA_ANCHO)
    const y0 = celda.arriba
    const y1 = celda.arriba - pt(TARJETA_ALTO)
    for (const [cx, cy, dx, dy] of [
      [x0, y0, -1, 1],
      [x1, y0, 1, 1],
      [x0, y1, -1, -1],
      [x1, y1, 1, -1],
    ] as const) {
      lineas.push({
        x1: cx + dx * pt(MARCA_SEPARACION),
        y1: cy,
        x2: cx + dx * pt(MARCA_SEPARACION + largo),
        y2: cy,
      })
      lineas.push({
        x1: cx,
        y1: cy + dy * pt(MARCA_SEPARACION),
        x2: cx,
        y2: cy + dy * pt(MARCA_SEPARACION + largo),
      })
    }
  }
  return lineas
}
