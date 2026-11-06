// Medidas del diseño aprobado en la tarea 4zr1vasmg, en pulgadas desde la
// esquina de arriba a la izquierda de la tarjeta. Salen del CSS del mockup
// (`mvp-design/tarjeta-fisica/tarjeta-fisica-vichente.html`), no de su captura:
// allá están escritas como `calc(N * var(--in))`.
//
// Las comparten el canvas (las caras rasterizadas) y el PDF (el QR vectorial
// va encima del reverso rasterizado y tiene que caer en el mismo lugar).

import { TARJETA_ALTO } from './geometria'

/** Nada importante cruza 1/8" adentro del corte. */
export const ZONA_SEGURA = 0.125

/** Resolución de las caras rasterizadas. A 600 ppp el texto sale igual de
 *  nítido que vectorial en una imprenta digital, y el PNG de una cara casi
 *  blanca pesa poco. */
export const PPP = 600

export const COLOR = {
  tinta900: '#1F1A14',
  tinta700: '#3A3024',
  tinta500: '#6B5E48',
  tinta300: '#9A8E76',
  fondoIcono: '#F3EEE4',
  lineaPie: '#ECE5D8',
} as const

/** Frente horizontal (opción B del mockup). */
export const FRENTE = {
  padding: 0.24,
  hueco: 0.22,
  logoLado: 1.5,
  /** El anillo gris alrededor del logo (`box-shadow 0 0 0 0.012in`). */
  logoAnillo: 0.012,
  etiquetaTam: 0.23,
  etiquetaInterlineado: 1.02,
  etiquetaTracking: -0.01,
  reglaAncho: 0.32,
  reglaAlto: 0.025,
  reglaMargen: 0.11,
  nombreTam: 0.1,
  /** Un nombre largo baja hasta aquí antes de cortarse con «…». */
  nombreTamMin: 0.075,
  nombreInterlineado: 1.25,
  nombreMaxLineas: 2,
} as const

/** Reverso: QR a la izquierda, dos pasos a la derecha y el pie de Vichente. */
export const REVERSO = {
  paddingIzq: 0.1,
  paddingDer: 0.18,
  hueco: 0.1,
  /** Lado del QR con su zona de silencio incluida. */
  qrLado: 1.45,
  columnaHueco: 0.13,
  pasoHueco: 0.08,
  iconoLado: 0.3,
  iconoProporcion: 0.58,
  textoTam: 0.122,
  textoInterlineado: 1.15,
  pieMargen: 0.02,
  piePadding: 0.09,
  pieTam: 0.07,
  pieHueco: 0.04,
  pieIsotipoAncho: 0.13,
} as const

/** Dónde cae el QR dentro del reverso. */
export function cajaQr() {
  return {
    x: REVERSO.paddingIzq,
    y: (TARJETA_ALTO - REVERSO.qrLado) / 2,
    lado: REVERSO.qrLado,
  }
}

/** Una portada más chica que esto, impresa a 1.5", baja de 300 ppp. */
export const PORTADA_MIN_PX = Math.ceil(FRENTE.logoLado * 300)
