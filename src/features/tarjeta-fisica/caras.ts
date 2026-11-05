// Las dos caras de la tarjeta física, dibujadas en canvas del lado del cliente
// por la misma razón que el resto del material gráfico: el admin corre en
// Vercel y ahí no hay con qué renderizar. Reproducen el mockup aprobado en la
// tarea 4zr1vasmg con las medidas de `diseno.ts`.
//
// Cambia por negocio: la portada (hace de logo) y el nombre. El QR cambia por
// tarjeta y en el PDF va como vector encima del reverso, así que el reverso que
// se embebe sale SIN QR; solo la vista previa lo dibuja aquí.

import { COLOR, FRENTE, REVERSO, cajaQr } from './diseno'
import { TARJETA_ALTO, TARJETA_ANCHO } from './geometria'
import type { MatrizQr } from './qr'

export function tamCanvas(ppp: number) {
  return { ancho: Math.round(TARJETA_ANCHO * ppp), alto: Math.round(TARJETA_ALTO * ppp) }
}

type Estilo = { peso: number; color: string }
type Palabra = Estilo & { texto: string }

function fuente(peso: number, tamPx: number) {
  return `${peso} ${tamPx}px Outfit, sans-serif`
}

/** Dónde va la línea base para centrar el texto en su caja de línea, como lo
 *  hace CSS: el interlineado sobrante se reparte arriba y abajo. */
function lineaBase(ctx: CanvasRenderingContext2D, top: number, altoLinea: number) {
  const m = ctx.measureText('Hg')
  const ascenso = m.fontBoundingBoxAscent
  const descenso = m.fontBoundingBoxDescent
  return top + (altoLinea - (ascenso + descenso)) / 2 + ascenso
}

/** Parte palabras (cada una con su peso) en líneas de a lo más `maxAncho`. */
function partir(
  ctx: CanvasRenderingContext2D,
  palabras: Palabra[],
  tamPx: number,
  maxAncho: number,
): Palabra[][] {
  const ancho = (p: Palabra) => {
    ctx.font = fuente(p.peso, tamPx)
    return ctx.measureText(p.texto).width
  }
  const espacio = (p: Palabra) => {
    ctx.font = fuente(p.peso, tamPx)
    return ctx.measureText(' ').width
  }

  const lineas: Palabra[][] = []
  let actual: Palabra[] = []
  let anchoActual = 0
  for (const palabra of palabras) {
    const w = ancho(palabra)
    const extra = actual.length ? espacio(palabra) + w : w
    if (actual.length && anchoActual + extra > maxAncho) {
      lineas.push(actual)
      actual = [palabra]
      anchoActual = w
    } else {
      actual.push(palabra)
      anchoActual += extra
    }
  }
  if (actual.length) lineas.push(actual)
  return lineas
}

function palabrasDe(texto: string, estilo: Estilo): Palabra[] {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ texto: t, ...estilo }))
}

function dibujarLinea(
  ctx: CanvasRenderingContext2D,
  linea: Palabra[],
  x: number,
  base: number,
  tamPx: number,
) {
  let cursor = x
  linea.forEach((p, i) => {
    ctx.font = fuente(p.peso, tamPx)
    if (i > 0) cursor += ctx.measureText(' ').width
    ctx.fillStyle = p.color
    ctx.fillText(p.texto, cursor, base)
    cursor += ctx.measureText(p.texto).width
  })
}

/** El nombre del negocio cabe en `maxLineas` bajando el tamaño hasta el mínimo;
 *  si ni así cabe, la última línea se corta con «…». */
function ajustarNombre(ctx: CanvasRenderingContext2D, nombre: string, maxAncho: number, px: Px) {
  const estilo = { peso: 600, color: COLOR.tinta500 }
  let tam: number = FRENTE.nombreTam
  for (; tam >= FRENTE.nombreTamMin - 1e-9; tam -= 0.005) {
    const lineas = partir(ctx, palabrasDe(nombre, estilo), px(tam), maxAncho)
    if (lineas.length <= FRENTE.nombreMaxLineas) return { tam, lineas }
  }
  tam = FRENTE.nombreTamMin
  const lineas = partir(ctx, palabrasDe(nombre, estilo), px(tam), maxAncho).slice(
    0,
    FRENTE.nombreMaxLineas,
  )
  const ultima = lineas[lineas.length - 1]
  ctx.font = fuente(estilo.peso, px(tam))
  const texto = () => ultima.map((p) => p.texto).join(' ')
  while (ultima.length && ctx.measureText(`${texto()}…`).width > maxAncho) {
    const p = ultima[ultima.length - 1]
    if (p.texto.length > 1) p.texto = p.texto.slice(0, -1)
    else ultima.pop()
  }
  if (ultima.length) ultima[ultima.length - 1].texto += '…'
  return { tam, lineas }
}

type Px = (pulgadas: number) => number

function fondoBlanco(ctx: CanvasRenderingContext2D) {
  // Blanco en las dos caras: si el corte se mueve un poco, no queda una orilla
  // de otro color.
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

export type DatosFrente = {
  /** La portada del negocio, que en el piloto hace de logo. */
  portada: HTMLImageElement
  nombre: string
}

export function dibujarFrente(ctx: CanvasRenderingContext2D, datos: DatosFrente, ppp: number) {
  const px: Px = (pulgadas) => pulgadas * ppp
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  fondoBlanco(ctx)

  // Logo: la portada recortada en círculo (`object-fit: cover`), con el anillo
  // gris fino del mockup por fuera.
  const radio = px(FRENTE.logoLado / 2)
  const cx = px(FRENTE.padding) + radio
  const cy = px(TARJETA_ALTO / 2)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radio, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const { portada } = datos
  const escala = Math.max((radio * 2) / portada.width, (radio * 2) / portada.height)
  const w = portada.width * escala
  const h = portada.height * escala
  ctx.drawImage(portada, cx - w / 2, cy - h / 2, w, h)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, radio + px(FRENTE.logoAnillo / 2), 0, Math.PI * 2)
  ctx.lineWidth = px(FRENTE.logoAnillo)
  ctx.strokeStyle = 'rgba(31,26,20,0.10)'
  ctx.stroke()

  // Columna de texto.
  const x = px(FRENTE.padding + FRENTE.logoLado + FRENTE.hueco)
  const maxAncho = px(TARJETA_ANCHO - FRENTE.padding) - x

  // «Tarjeta de cliente» en dos líneas fijas, como el mockup. Solo se encoge si
  // alguna no cabe en la columna.
  const lineasEtiqueta = ['Tarjeta', 'de cliente']
  let tamEtiqueta = FRENTE.etiquetaTam
  const anchoEtiqueta = () => {
    ctx.font = fuente(800, px(tamEtiqueta))
    ctx.letterSpacing = `${px(tamEtiqueta) * FRENTE.etiquetaTracking}px`
    const ancho = Math.max(...lineasEtiqueta.map((l) => ctx.measureText(l).width))
    ctx.letterSpacing = '0px'
    return ancho
  }
  while (anchoEtiqueta() > maxAncho && tamEtiqueta > 0.15) tamEtiqueta -= 0.005

  const nombre = ajustarNombre(ctx, datos.nombre, maxAncho, px)
  const altoLineaEtiqueta = tamEtiqueta * FRENTE.etiquetaInterlineado
  const altoLineaNombre = nombre.tam * FRENTE.nombreInterlineado
  const altoBloque =
    lineasEtiqueta.length * altoLineaEtiqueta +
    FRENTE.reglaMargen * 2 +
    FRENTE.reglaAlto +
    nombre.lineas.length * altoLineaNombre
  let top = (TARJETA_ALTO - altoBloque) / 2

  ctx.font = fuente(800, px(tamEtiqueta))
  ctx.letterSpacing = `${px(tamEtiqueta) * FRENTE.etiquetaTracking}px`
  ctx.fillStyle = COLOR.tinta900
  for (const linea of lineasEtiqueta) {
    ctx.fillText(linea, x, lineaBase(ctx, px(top), px(altoLineaEtiqueta)))
    top += altoLineaEtiqueta
  }
  ctx.letterSpacing = '0px'

  top += FRENTE.reglaMargen
  ctx.beginPath()
  ctx.roundRect(x, px(top), px(FRENTE.reglaAncho), px(FRENTE.reglaAlto), px(2 / 150))
  ctx.fillStyle = COLOR.tinta900
  ctx.fill()
  top += FRENTE.reglaAlto + FRENTE.reglaMargen

  for (const linea of nombre.lineas) {
    ctx.font = fuente(600, px(nombre.tam))
    dibujarLinea(ctx, linea, x, lineaBase(ctx, px(top), px(altoLineaNombre)), px(nombre.tam))
    top += altoLineaNombre
  }

  ctx.restore()
}

// Íconos del mockup, en viewBox de 24 con trazo de 2.
function iconoTarjeta(): Path2D {
  const p = new Path2D()
  p.roundRect(2.5, 5, 19, 14, 2.5)
  p.addPath(new Path2D('M2.5 10h19M6.5 15h4'))
  return p
}

function iconoCelular(): Path2D {
  const p = new Path2D()
  p.roundRect(6, 2.5, 12, 19, 2.5)
  p.addPath(new Path2D('M10.5 18h3'))
  return p
}

function dibujarIcono(
  ctx: CanvasRenderingContext2D,
  icono: Path2D,
  x: number,
  top: number,
  lado: number,
) {
  ctx.beginPath()
  ctx.arc(x + lado / 2, top + lado / 2, lado / 2, 0, Math.PI * 2)
  ctx.fillStyle = COLOR.fondoIcono
  ctx.fill()

  const ladoIcono = lado * REVERSO.iconoProporcion
  const escala = ladoIcono / 24
  ctx.save()
  ctx.translate(x + (lado - ladoIcono) / 2, top + (lado - ladoIcono) / 2)
  ctx.scale(escala, escala)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = COLOR.tinta900
  ctx.stroke(icono)
  ctx.restore()
}

export type DatosReverso = {
  isotipo: HTMLImageElement
  /** Solo para la vista previa. El PDF dibuja el QR real como vector. */
  qr?: MatrizQr
}

export function dibujarReverso(ctx: CanvasRenderingContext2D, datos: DatosReverso, ppp: number) {
  const px: Px = (pulgadas) => pulgadas * ppp
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  fondoBlanco(ctx)

  const caja = cajaQr()
  if (datos.qr) {
    const modulo = px(caja.lado) / datos.qr.lado
    ctx.fillStyle = '#000000'
    for (let f = 0; f < datos.qr.lado; f++) {
      for (let c = 0; c < datos.qr.lado; c++) {
        if (!datos.qr.oscuro(f, c)) continue
        // Se redondea por borde y no por módulo para que no queden rendijas.
        const x0 = Math.round(px(caja.x) + c * modulo)
        const y0 = Math.round(px(caja.y) + f * modulo)
        const x1 = Math.round(px(caja.x) + (c + 1) * modulo)
        const y1 = Math.round(px(caja.y) + (f + 1) * modulo)
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
    }
  }

  // Columna de la derecha: dos pasos y el pie, centrados contra el QR.
  const xCol = caja.x + caja.lado + REVERSO.hueco
  const anchoCol = TARJETA_ANCHO - REVERSO.paddingDer - xCol
  const xTexto = xCol + REVERSO.iconoLado + REVERSO.pasoHueco
  const anchoTexto = px(anchoCol - REVERSO.iconoLado - REVERSO.pasoHueco)
  const tam = px(REVERSO.textoTam)
  const altoLinea = REVERSO.textoTam * REVERSO.textoInterlineado

  const fuerte = { peso: 800, color: COLOR.tinta900 }
  const suave = { peso: 500, color: COLOR.tinta700 }
  const pasos = [
    { icono: iconoTarjeta(), palabras: palabrasDe('Muestra esta tarjeta en caja', fuerte) },
    {
      icono: iconoCelular(),
      palabras: [
        ...palabrasDe('Escanéala', fuerte),
        ...palabrasDe('para consultar tus beneficios', suave),
      ],
    },
  ].map((paso) => {
    const lineas = partir(ctx, paso.palabras, tam, anchoTexto)
    return { ...paso, lineas, alto: Math.max(REVERSO.iconoLado, lineas.length * altoLinea) }
  })

  const pieTexto = 'con Vichente · vichente.com'
  ctx.font = fuente(600, px(REVERSO.pieTam))
  const metricaPie = ctx.measureText('Hg')
  const altoLineaPie = (metricaPie.fontBoundingBoxAscent + metricaPie.fontBoundingBoxDescent) / ppp
  const isoAlto = REVERSO.pieIsotipoAncho * (datos.isotipo.height / datos.isotipo.width)
  const altoFilaPie = Math.max(isoAlto, altoLineaPie)
  const grosorLineaPie = 1 / 150
  const altoPie = REVERSO.pieMargen + grosorLineaPie + REVERSO.piePadding + altoFilaPie

  const altoCol =
    pasos.reduce((suma, p) => suma + p.alto, 0) + REVERSO.columnaHueco * pasos.length + altoPie
  let top = (TARJETA_ALTO - altoCol) / 2

  for (const paso of pasos) {
    dibujarIcono(
      ctx,
      paso.icono,
      px(xCol),
      px(top + (paso.alto - REVERSO.iconoLado) / 2),
      px(REVERSO.iconoLado),
    )
    let topLinea = top + (paso.alto - paso.lineas.length * altoLinea) / 2
    for (const linea of paso.lineas) {
      ctx.font = fuente(linea[0].peso, tam)
      dibujarLinea(ctx, linea, px(xTexto), lineaBase(ctx, px(topLinea), px(altoLinea)), tam)
      topLinea += altoLinea
    }
    top += paso.alto + REVERSO.columnaHueco
  }

  // Pie: línea fina a todo el ancho de la columna, isotipo y el texto.
  top += REVERSO.pieMargen
  ctx.fillStyle = COLOR.lineaPie
  ctx.fillRect(px(xCol), px(top), px(anchoCol), Math.max(1, px(grosorLineaPie)))
  top += grosorLineaPie + REVERSO.piePadding

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    datos.isotipo,
    px(xCol),
    px(top + (altoFilaPie - isoAlto) / 2),
    px(REVERSO.pieIsotipoAncho),
    px(isoAlto),
  )
  ctx.font = fuente(600, px(REVERSO.pieTam))
  ctx.fillStyle = COLOR.tinta300
  ctx.fillText(
    pieTexto,
    px(xCol + REVERSO.pieIsotipoAncho + REVERSO.pieHueco),
    lineaBase(ctx, px(top + (altoFilaPie - altoLineaPie) / 2), px(altoLineaPie)),
  )

  ctx.restore()
}
