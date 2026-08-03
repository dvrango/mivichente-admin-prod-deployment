import QRCode from 'qrcode'

// Etiqueta horizontal "Mira nuestro menú en" — la pieza que el negocio monta
// sobre sus propias fotos. Se dibuja en canvas del lado del cliente: el admin
// corre en Vercel y ahí no hay Chrome ni binarios, así que cualquier render de
// servidor obligaría a meter puppeteer o un servicio aparte.
//
// El PNG sale con fondo transparente fuera de la tarjeta — es lo que permite
// montarla sobre una foto sin que quede el recuadro blanco.

export const ANCHO = 2048
export const ALTO = 1152

const CREMA = '#FDF6EC'
const NARANJA = '#F98001'
const NARANJA_ACENTO = '#FD6A02'
const TINTA = '#111111'

const RADIO = 104

// El QR se genera con el fondo crema de la tarjeta y NO blanco: sobre el crema
// un recuadro blanco se ve como un parche pegado. El contraste crema/negro
// sigue muy por encima de lo que necesita un lector.
const QR_FONDO = CREMA
const QR_TINTA = '#000000'

// -l Q = 25% de corrección de error. Es el nivel con el que se midió el tamaño
// del código al elegir slug sobre UUID: aguanta que el papel se manche o se
// despegue una esquina sin volverse ilegible.
const QR_NIVEL = 'Q' as const

// Zona de silencio del estándar. Recortarla es la causa más común de que un QR
// impreso lea mal, así que se dibuja explícita en vez de confiar en el margen
// del layout.
const QR_QUIET = 4

export type DatosEtiqueta = {
  /** URL exacta que codifica el QR. Ya viene armada por quien llama. */
  url: string
}

/** Carga Outfit desde /public en vez de confiar en la fuente del sistema: si no
 *  está lista antes de dibujar, el canvas cae a la fuente por defecto y la pieza
 *  sale con otra letra sin avisar. */
export async function cargarFuente(): Promise<void> {
  if (typeof document === 'undefined') return
  // Outfit se sirve como variable (100–900): un solo archivo cubre todos los pesos.
  const fuente = new FontFace('Outfit', 'url(/brand/fonts/outfit-latin.woff2)', {
    weight: '100 900',
    style: 'normal',
  })
  await fuente.load()
  document.fonts.add(fuente)
}

export function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    img.src = src
  })
}

function tarjetaPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(RADIO, 0)
  ctx.lineTo(ANCHO - RADIO, 0)
  ctx.quadraticCurveTo(ANCHO, 0, ANCHO, RADIO)
  ctx.lineTo(ANCHO, ALTO - RADIO)
  ctx.quadraticCurveTo(ANCHO, ALTO, ANCHO - RADIO, ALTO)
  ctx.lineTo(RADIO, ALTO)
  ctx.quadraticCurveTo(0, ALTO, 0, ALTO - RADIO)
  ctx.lineTo(0, RADIO)
  ctx.quadraticCurveTo(0, 0, RADIO, 0)
  ctx.closePath()
}

/** Acento naranja de la esquina superior izquierda: sigue el redondeo de la
 *  tarjeta y baja con una diagonal cóncava. */
function dibujarAcento(ctx: CanvasRenderingContext2D) {
  const ancho = ANCHO * 0.245
  const alto = ALTO * 0.165

  ctx.save()
  tarjetaPath(ctx)
  ctx.clip()

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(ancho, 0)
  ctx.quadraticCurveTo(ancho * 0.16, alto * 0.16, 0, alto)
  ctx.closePath()
  ctx.fillStyle = NARANJA_ACENTO
  ctx.fill()

  ctx.restore()
}

function dibujarQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  centroX: number,
  centroY: number,
  lado: number,
) {
  const qr = QRCode.create(url, { errorCorrectionLevel: QR_NIVEL })
  const modulos = qr.modules.size
  const total = modulos + QR_QUIET * 2

  // El módulo se redondea a entero: con fracciones, el redondeo por celda deja
  // filas de ancho distinto y el código se ve rayado al imprimir.
  const escala = Math.floor(lado / total)
  const ladoReal = escala * total
  const x0 = Math.round(centroX - ladoReal / 2)
  const y0 = Math.round(centroY - ladoReal / 2)

  ctx.fillStyle = QR_FONDO
  ctx.fillRect(x0, y0, ladoReal, ladoReal)

  ctx.fillStyle = QR_TINTA
  for (let fila = 0; fila < modulos; fila++) {
    for (let col = 0; col < modulos; col++) {
      if (!qr.modules.get(fila, col)) continue
      ctx.fillRect(x0 + (col + QR_QUIET) * escala, y0 + (fila + QR_QUIET) * escala, escala, escala)
    }
  }
}

/** Lockup "VICHENTE / A P P". El wordmark es texto, no imagen: así escala con
 *  la pieza y no depende de un PNG más. */
function dibujarLockup(
  ctx: CanvasRenderingContext2D,
  isotipo: HTMLImageElement,
  x: number,
  centroY: number,
) {
  const isoAlto = ALTO * 0.235
  const isoAncho = (isotipo.width / isotipo.height) * isoAlto
  ctx.drawImage(isotipo, x, centroY - isoAlto / 2, isoAncho, isoAlto)

  const textoX = x + isoAncho + ANCHO * 0.018

  const tamMarca = ALTO * 0.088
  ctx.fillStyle = NARANJA
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 ${tamMarca}px Outfit, sans-serif`
  ctx.letterSpacing = `${tamMarca * 0.04}px`
  const marca = 'VICHENTE'
  ctx.fillText(marca, textoX, centroY + tamMarca * 0.16)
  const marcaAncho = ctx.measureText(marca).width

  // "A P P" centrado bajo el wordmark, flanqueado por dos filetes.
  const tamApp = ALTO * 0.042
  ctx.font = `600 ${tamApp}px Outfit, sans-serif`
  ctx.letterSpacing = `${tamApp * 0.55}px`
  const app = 'APP'
  const appAncho = ctx.measureText(app).width
  const appY = centroY + tamMarca * 0.16 + tamApp * 1.5
  const appX = textoX + (marcaAncho - appAncho) / 2
  ctx.fillText(app, appX, appY)
  ctx.letterSpacing = '0px'

  const fileteLargo = ALTO * 0.032
  const fileteGap = ALTO * 0.022
  const fileteY = appY - tamApp * 0.32
  ctx.strokeStyle = NARANJA
  ctx.lineWidth = Math.max(2, ALTO * 0.0035)
  ctx.beginPath()
  ctx.moveTo(appX - fileteGap - fileteLargo, fileteY)
  ctx.lineTo(appX - fileteGap, fileteY)
  ctx.moveTo(appX + appAncho + fileteGap, fileteY)
  ctx.lineTo(appX + appAncho + fileteGap + fileteLargo, fileteY)
  ctx.stroke()
}

/** Dibuja la etiqueta completa. El canvas se limpia antes: fuera de la tarjeta
 *  queda transparente. */
export function dibujarEtiqueta(
  ctx: CanvasRenderingContext2D,
  isotipo: HTMLImageElement,
  { url }: DatosEtiqueta,
) {
  ctx.clearRect(0, 0, ANCHO, ALTO)

  tarjetaPath(ctx)
  ctx.fillStyle = CREMA
  ctx.fill()

  dibujarAcento(ctx)

  const margenIzq = ANCHO * 0.068
  const divisorX = ANCHO * 0.556

  const tamTitulo = ALTO * 0.132
  ctx.fillStyle = TINTA
  ctx.font = `800 ${tamTitulo}px Outfit, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Mira nuestro', margenIzq, ALTO * 0.34)
  ctx.fillText('menú en', margenIzq, ALTO * 0.34 + tamTitulo * 1.12)

  dibujarLockup(ctx, isotipo, margenIzq, ALTO * 0.665)

  ctx.strokeStyle = NARANJA
  ctx.lineWidth = Math.max(2, ANCHO * 0.0022)
  ctx.beginPath()
  ctx.moveTo(divisorX, ALTO * 0.13)
  ctx.lineTo(divisorX, ALTO * 0.735)
  ctx.stroke()

  dibujarQr(ctx, url, (divisorX + ANCHO) / 2, ALTO * 0.5, ALTO * 0.68)
}
