import { describe, expect, it } from 'vitest'
import {
  COLUMNAS,
  FILAS,
  HOJA_ALTO,
  HOJA_ANCHO,
  PT_POR_PULGADA,
  TARJETA_ALTO,
  TARJETA_ANCHO,
  TARJETAS_POR_HOJA,
  aPagina,
  altoRejilla,
  anchoRejilla,
  celdas,
  marcasDeCorte,
} from './geometria'

const pt = (pulgadas: number) => pulgadas * PT_POR_PULGADA
const CERCA = 1e-9

describe('geometría de la hoja', () => {
  it('son 20 tarjetas de 3.5 × 2" que caben en el tabloide horizontal', () => {
    expect(TARJETAS_POR_HOJA).toBe(20)
    expect(celdas()).toHaveLength(20)
    expect(anchoRejilla()).toBeLessThanOrEqual(HOJA_ANCHO)
    expect(altoRejilla()).toBeLessThanOrEqual(HOJA_ALTO)
  })

  it('la rejilla va centrada, para que el corte coincida en las dos caras', () => {
    const lista = celdas()
    const izq = Math.min(...lista.map((c) => c.izquierda))
    const der = Math.max(...lista.map((c) => c.izquierda + pt(TARJETA_ANCHO)))
    const sup = Math.max(...lista.map((c) => c.arriba))
    const inf = Math.min(...lista.map((c) => c.arriba - pt(TARJETA_ALTO)))
    expect(izq).toBeCloseTo(pt(HOJA_ANCHO) - der, 9)
    expect(inf).toBeCloseTo(pt(HOJA_ALTO) - sup, 9)
  })

  it('ninguna tarjeta se sale de la hoja ni pisa a otra', () => {
    const lista = celdas()
    for (const c of lista) {
      expect(c.izquierda).toBeGreaterThanOrEqual(0)
      expect(c.izquierda + pt(TARJETA_ANCHO)).toBeLessThanOrEqual(pt(HOJA_ANCHO) + CERCA)
      expect(c.arriba).toBeLessThanOrEqual(pt(HOJA_ALTO) + CERCA)
      expect(c.arriba - pt(TARJETA_ALTO)).toBeGreaterThanOrEqual(-CERCA)
    }
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]
        const b = lista[j]
        const separadasX =
          a.izquierda + pt(TARJETA_ANCHO) <= b.izquierda + CERCA ||
          b.izquierda + pt(TARJETA_ANCHO) <= a.izquierda + CERCA
        const separadasY =
          a.arriba - pt(TARJETA_ALTO) >= b.arriba - CERCA ||
          b.arriba - pt(TARJETA_ALTO) >= a.arriba - CERCA
        expect(separadasX || separadasY).toBe(true)
      }
    }
  })

  it('las marcas de corte quedan dentro de la hoja y fuera de todas las tarjetas', () => {
    const lista = celdas()
    const marcas = marcasDeCorte()
    expect(marcas.length).toBeGreaterThan(0)
    const dentroDeTarjeta = (x: number, y: number) =>
      lista.some(
        (c) =>
          x > c.izquierda + CERCA &&
          x < c.izquierda + pt(TARJETA_ANCHO) - CERCA &&
          y < c.arriba - CERCA &&
          y > c.arriba - pt(TARJETA_ALTO) + CERCA,
      )
    for (const m of marcas) {
      for (const [x, y] of [
        [m.x1, m.y1],
        [m.x2, m.y2],
        [(m.x1 + m.x2) / 2, (m.y1 + m.y2) / 2],
      ]) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(pt(HOJA_ANCHO))
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(pt(HOJA_ALTO))
        expect(dentroDeTarjeta(x, y)).toBe(false)
      }
    }
  })

  it('hay una marca en cada extremo de cada línea de corte', () => {
    // Tarjetas pegadas: 5 líneas verticales y 6 horizontales, dos marcas cada una.
    expect(marcasDeCorte()).toHaveLength((COLUMNAS + 1) * 2 + (FILAS + 1) * 2)
  })

  it('con giro 180 la tarjeta rota sobre su centro y sigue dentro de su celda', () => {
    const celda = celdas()[0]
    const centro0 = aPagina(celda, 0, TARJETA_ANCHO / 2, TARJETA_ALTO / 2)
    const centro180 = aPagina(celda, 180, TARJETA_ANCHO / 2, TARJETA_ALTO / 2)
    expect(centro180.x).toBeCloseTo(centro0.x, 9)
    expect(centro180.y).toBeCloseTo(centro0.y, 9)

    // La esquina de arriba a la izquierda de la tarjeta cae abajo a la derecha.
    const esquina = aPagina(celda, 180, 0, 0)
    expect(esquina.x).toBeCloseTo(celda.izquierda + pt(TARJETA_ANCHO), 9)
    expect(esquina.y).toBeCloseTo(celda.arriba - pt(TARJETA_ALTO), 9)
  })
})
