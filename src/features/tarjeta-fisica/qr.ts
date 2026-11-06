import QRCode from 'qrcode'

// El QR de cada tarjeta. Mismo nivel y zona de silencio que la etiqueta del
// menú y el QR del mostrador (`material-grafico/etiqueta-menu.ts`): Q aguanta
// manchas y el reflejo del laminado, y la zona de silencio de 4 módulos es la
// que pide el estándar; recortarla es la causa más común de que un QR impreso
// no lea.
export const QR_NIVEL = 'Q' as const
export const QR_SILENCIO = 4

export type MatrizQr = {
  /** Módulos por lado, contando la zona de silencio. */
  lado: number
  /** Path SVG con un subpath por cada tramo horizontal de módulos oscuros, en
   *  unidades de módulo y con la zona de silencio ya sumada. */
  path: string
  /** Para dibujar módulo por módulo (el canvas de la vista previa). */
  oscuro: (fila: number, columna: number) => boolean
}

/**
 * Un solo path con todos los módulos oscuros. En el PDF se rellena de una vez:
 * con un rectángulo por módulo, los visores dibujan una línea fina entre
 * módulos vecinos por el antialiasing, y en pantalla parece un QR rayado.
 * Los tramos se juntan por fila para que el path no lleve un cuadro por módulo.
 */
export function matrizQr(url: string): MatrizQr {
  const qr = QRCode.create(url, { errorCorrectionLevel: QR_NIVEL })
  const n = qr.modules.size
  const oscuroSinMargen = (fila: number, columna: number) =>
    fila >= 0 && columna >= 0 && fila < n && columna < n && Boolean(qr.modules.get(fila, columna))

  const partes: string[] = []
  for (let fila = 0; fila < n; fila++) {
    let columna = 0
    while (columna < n) {
      if (!oscuroSinMargen(fila, columna)) {
        columna++
        continue
      }
      const inicio = columna
      while (columna < n && oscuroSinMargen(fila, columna)) columna++
      const largo = columna - inicio
      partes.push(`M${inicio + QR_SILENCIO} ${fila + QR_SILENCIO}h${largo}v1h-${largo}z`)
    }
  }

  return {
    lado: n + QR_SILENCIO * 2,
    path: partes.join(''),
    oscuro: (fila, columna) => oscuroSinMargen(fila - QR_SILENCIO, columna - QR_SILENCIO),
  }
}
