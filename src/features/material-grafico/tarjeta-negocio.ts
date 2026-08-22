// Pieza "Ya estamos en Vichente App": la imagen que el negocio recién dado de
// alta comparte en sus redes.
//
// La publicidad es NUESTRA, no del negocio: quien ve el post ya es su cliente y
// probablemente no sabe qué es Vichente. Por eso la pieza cierra con los cuatro
// municipios y con dónde bajar la app, no con los datos de contacto del negocio.
//
// Composición: nada de tarjeta blanca flotando sobre el fondo. El avatar va a la
// izquierda y el nombre a la derecha, en fila — así el texto usa el ancho en vez
// de apilarse centrado, que es lo que obligaba a encoger todo para que cupiera.
// Los elementos de marca (paleta, avatar redondo, categoría en naranja, skyline)
// siguen siendo los de la tarjeta de vichente.com/<slug>
// (landing/src/components/BusinessLandingCard.tsx).
//
// Qué NO va, y por qué:
//
// | Fuera | Razón |
// |---|---|
// | Botones de WhatsApp / ver negocio | Una imagen no se toca |
// | URL escrita y QR | Se ve en un teléfono: nadie teclea lo que lee en una foto, y ese mismo teléfono no escanea su propia pantalla. El link va en el texto del post |
// | Dirección postal, descripción, badge de envío | Detalle de ficha. En un anuncio son renglones de gris que nadie lee |
//
// El render es del lado del cliente, como la etiqueta del menú: el admin corre
// en Vercel y ahí no hay Chrome.

export const ANCHO = 1080
export const ALTO = 1350

const NARANJA = '#F07A2C'
const NAVY = '#14213D'

// Barra inferior: el único paso concreto que la imagen puede pedir. Va en navy
// para que no compita con la marca y se lea como pie de anuncio.
const BARRA_ALTO = 190
const BARRA_Y = ALTO - BARRA_ALTO

const AVATAR_CX = 306
const AVATAR_CY = 588
const AVATAR_RADIO = 186

// Columna de texto a la derecha del avatar.
const TEXTO_X = 548
const TEXTO_ANCHO = ANCHO - TEXTO_X - 60

// Los cuatro municipios con negocios dados de alta. Van escritos y no salen de
// la DB a propósito: son la promesa de cobertura de la marca, no el conteo de
// hoy. Al abrir un municipio nuevo se agrega aquí.
const MUNICIPIOS = 'Vicente Guerrero • Súchil • Nombre de Dios • Villa Unión'
const INSTAGRAM = '@vichenteapp'

// El entry point universal (landing/src/app/app/page.tsx): detecta plataforma y
// manda al lugar correcto, así que sirve también en iPhone, donde el botón de
// Play Store no lleva a ningún lado. Va sin `?src=` y sin `https://` porque se
// teclea a mano desde la foto — es corta a propósito, al revés que la URL del
// perfil del negocio, que por eso no aparece en la pieza. El slug `app` está
// reservado en la DB y en el admin, no lo puede tomar un negocio.
const URL_APP = 'vichente.com/app'

// Paths en viewBox 24×24. Los dos primeros vienen de BusinessLandingCard, para
// que no se desincronicen a base de redibujarlos distinto en cada superficie.
const ICONO_ESCUDO =
  'M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z'
const ICONO_PALOMA = 'M9.64 15.95l-3.55-3.46 1.32-1.35 2.23 2.17 5.4-5.55 1.32 1.35z'
const ICONO_INSTAGRAM_MARCO =
  'M2 7.5A5.5 5.5 0 017.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9z'
const ICONO_INSTAGRAM_LENTE = 'M12 7.6a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8z'
const ICONO_PLAY =
  'M4 2.4v19.2c0 .55.6.9 1.05.6l14.4-9.6a.72.72 0 000-1.2L5.05 1.8A.72.72 0 004 2.4z'

export type DatosTarjeta = {
  nombre: string
  categoria: string | null
  verificado: boolean
}

export type ImagenesTarjeta = {
  isotipo: HTMLImageElement
  skyline: HTMLImageElement
  /** Foto del negocio. null = se cae al isotipo, igual que la tarjeta web. */
  foto: HTMLImageElement | null
}

export async function cargarFuente(): Promise<void> {
  if (typeof document === 'undefined') return
  const fuente = new FontFace('Outfit', 'url(/brand/fonts/outfit-latin.woff2)', {
    weight: '100 900',
    style: 'normal',
  })
  await fuente.load()
  document.fonts.add(fuente)
}

/** `crossOrigin` va ANTES de `src` y no es opcional para la foto del negocio:
 *  vive en Supabase Storage (otro origen) y sin él el canvas queda tainted —
 *  `toBlob` truena con SecurityError recién al descargar, no al dibujar. */
export function cargarImagen(src: string, cruzada = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cruzada) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    img.src = src
  })
}

function fuenteDe(peso: number, tam: number) {
  return `${peso} ${tam}px Outfit, sans-serif`
}

function partirEnLineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxAncho: number,
  maxLineas: number,
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const lineas: string[] = []
  let actual = ''

  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra
    if (ctx.measureText(tentativa).width <= maxAncho || !actual) {
      actual = tentativa
      continue
    }
    lineas.push(actual)
    actual = palabra
    if (lineas.length === maxLineas) break
  }
  if (lineas.length < maxLineas && actual) lineas.push(actual)
  return lineas
}

/** Baja el tamaño hasta que el nombre completo quepa en tres líneas. Lo teclea
 *  quien da de alta el negocio y va de "Snacky" a "Mia Itzamara — Ropa y
 *  Accesorios": sin esto, el largo decide el diseño. */
function ajustarNombre(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxAncho: number,
): { tam: number; lineas: string[] } {
  const normalizado = texto.split(/\s+/).filter(Boolean).join(' ')
  for (let tam = 62; tam >= 34; tam -= 2) {
    ctx.font = fuenteDe(800, tam)
    const lineas = partirEnLineas(ctx, normalizado, maxAncho, 3)
    const completo = lineas.join(' ') === normalizado
    if (completo && lineas.every((l) => ctx.measureText(l).width <= maxAncho)) {
      return { tam, lineas }
    }
  }
  ctx.font = fuenteDe(800, 34)
  return { tam: 34, lineas: partirEnLineas(ctx, normalizado, maxAncho, 3) }
}

function dibujarIcono(
  ctx: CanvasRenderingContext2D,
  d: string,
  x: number,
  y: number,
  tam: number,
  estilo: { fill?: string; stroke?: string; grosor?: number },
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(tam / 24, tam / 24)
  const path = new Path2D(d)
  if (estilo.fill) {
    ctx.fillStyle = estilo.fill
    ctx.fill(path)
  }
  if (estilo.stroke) {
    ctx.strokeStyle = estilo.stroke
    ctx.lineWidth = estilo.grosor ?? 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(path)
  }
  ctx.restore()
}

function rejilla(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, filas: number) {
  const paso = 34
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      ctx.beginPath()
      ctx.arc(x + c * paso, y + f * paso, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Fondo: degradado crema, manchas suaves y retículas de puntos. Sin tarjeta —
 *  el contenido se apoya directo aquí. */
function dibujarFondo(ctx: CanvasRenderingContext2D, skyline: HTMLImageElement) {
  const grad = ctx.createLinearGradient(0, 0, 0, ALTO)
  grad.addColorStop(0, '#FFFBF6')
  grad.addColorStop(1, '#FCE9D8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // Manchas: las mismas del círculo decorativo de la tarjeta web, sueltas.
  const mancha = (cx: number, cy: number, r: number) => {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, '#FCD9BC')
    g.addColorStop(1, '#FDF3EA')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.55
  mancha(-40, 300, 230)
  mancha(1090, 700, 190)
  ctx.globalAlpha = 1

  ctx.fillStyle = NARANJA
  ctx.globalAlpha = 0.16
  rejilla(ctx, 58, 96, 4, 3)
  rejilla(ctx, 862, 330, 5, 4)
  rejilla(ctx, 78, 806, 3, 2)
  ctx.globalAlpha = 1

  // El skyline se apoya sobre la barra inferior, no sobre el borde del lienzo.
  const alto = (skyline.height / skyline.width) * ANCHO
  ctx.drawImage(skyline, 0, BARRA_Y - alto, ANCHO, alto)
}

/** Encabezado: la ceja y el lockup de marca.
 *
 *  El lockup se COMPONE aquí (isotipo + "Vichente" en Outfit) en vez de usar un
 *  PNG con wordmark, porque el set de logo vigente
 *  (`Vichente App Marketing/logos/vichente_logo_moderno_*`) es puro isotipo: no
 *  hay archivo con la palabra. El `vichente-logo-completo.png` del landing sí la
 *  trae, pero es del logo ANTERIOR — el de la carpeta `deprecated`. */
function dibujarEncabezado(ctx: CanvasRenderingContext2D, isotipo: HTMLImageElement) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const tamCeja = 40
  ctx.font = fuenteDe(700, tamCeja)
  ctx.fillStyle = NAVY
  ctx.letterSpacing = `${tamCeja * 0.14}px`
  ctx.fillText('YA ESTAMOS EN', ANCHO / 2, 138)
  ctx.letterSpacing = '0px'

  const marca = 'Vichente'
  const tamMarca = 104
  ctx.font = fuenteDe(800, tamMarca)
  ctx.letterSpacing = '-2px'
  const anchoMarca = ctx.measureText(marca).width

  const isoAlto = 132
  const isoAncho = (isotipo.width / isotipo.height) * isoAlto
  const gap = 18
  const x0 = (ANCHO - (isoAncho + gap + anchoMarca)) / 2
  const baseY = 288

  ctx.drawImage(isotipo, x0, baseY - isoAlto * 0.82, isoAncho, isoAlto)
  // Naranja, como el wordmark del logo. La ceja va en navy para que el lockup
  // no se pierda dentro de un encabezado todo del mismo color.
  ctx.fillStyle = NARANJA
  ctx.textAlign = 'left'
  ctx.fillText(marca, x0 + isoAncho + gap, baseY)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'center'
}

function dibujarAvatar(
  ctx: CanvasRenderingContext2D,
  isotipo: HTMLImageElement,
  foto: HTMLImageElement | null,
) {
  ctx.save()
  ctx.shadowColor = 'rgba(240,122,44,0.28)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 16
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RADIO + 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RADIO, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#FFF1E6'
  ctx.fill()

  if (foto) {
    // `cover`: la foto llena el círculo sin deformarse, se recorta el excedente.
    const escala = Math.max((AVATAR_RADIO * 2) / foto.width, (AVATAR_RADIO * 2) / foto.height)
    const w = foto.width * escala
    const h = foto.height * escala
    ctx.drawImage(foto, AVATAR_CX - w / 2, AVATAR_CY - h / 2, w, h)
  } else {
    const isoAlto = AVATAR_RADIO * 2 * 0.66
    const isoAncho = (isotipo.width / isotipo.height) * isoAlto
    ctx.drawImage(isotipo, AVATAR_CX - isoAncho / 2, AVATAR_CY - isoAlto / 2, isoAncho, isoAlto)
  }
  ctx.restore()
}

/** Barra inferior, lo único accionable de la pieza. La URL manda y los otros dos
 *  van de apoyo: es la que funciona en cualquier teléfono y la que se puede
 *  teclear. */
function dibujarBarra(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NAVY
  ctx.fillRect(0, BARRA_Y, ANCHO, BARRA_ALTO)

  // La URL, con el dominio en blanco y /app en naranja para que la parte que se
  // teclea distinto salte a la vista.
  const tamUrl = 46
  const dominio = 'vichente.com'
  const ruta = URL_APP.slice(dominio.length)
  ctx.font = fuenteDe(800, tamUrl)
  const anchoDominio = ctx.measureText(dominio).width
  const anchoRuta = ctx.measureText(ruta).width
  const urlY = BARRA_Y + 74
  const urlX = (ANCHO - (anchoDominio + anchoRuta)) / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.fillText(dominio, urlX, urlY)
  ctx.fillStyle = NARANJA
  ctx.fillText(ruta, urlX + anchoDominio, urlY)

  const tam = 26
  ctx.font = fuenteDe(600, tam)
  const play = 'Google Play'
  const anchoPlay = ctx.measureText(play).width
  const anchoIg = ctx.measureText(INSTAGRAM).width
  const tamIcono = 28
  const gapIcono = 12
  const separacion = 56
  const total = tamIcono + gapIcono + anchoPlay + separacion + tamIcono + gapIcono + anchoIg
  let x = (ANCHO - total) / 2
  const filaY = BARRA_Y + 138
  const iconoY = filaY - tamIcono * 0.78

  dibujarIcono(ctx, ICONO_PLAY, x, iconoY, tamIcono, { fill: 'rgba(255,255,255,0.75)' })
  x += tamIcono + gapIcono
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(play, x, filaY)
  x += anchoPlay + separacion

  dibujarIcono(ctx, ICONO_INSTAGRAM_MARCO, x, iconoY, tamIcono, {
    stroke: 'rgba(255,255,255,0.75)',
    grosor: 2,
  })
  dibujarIcono(ctx, ICONO_INSTAGRAM_LENTE, x, iconoY, tamIcono, {
    stroke: 'rgba(255,255,255,0.75)',
    grosor: 2,
  })
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath()
  ctx.arc(x + tamIcono * 0.73, iconoY + tamIcono * 0.27, 2.6, 0, Math.PI * 2)
  ctx.fill()
  x += tamIcono + gapIcono
  ctx.fillText(INSTAGRAM, x, filaY)

  ctx.textAlign = 'center'
}

export function dibujarTarjetaNegocio(
  ctx: CanvasRenderingContext2D,
  { isotipo, skyline, foto }: ImagenesTarjeta,
  datos: DatosTarjeta,
) {
  ctx.clearRect(0, 0, ANCHO, ALTO)
  ctx.textBaseline = 'alphabetic'

  dibujarFondo(ctx, skyline)
  dibujarEncabezado(ctx, isotipo)
  dibujarAvatar(ctx, isotipo, foto)

  // La columna de texto se centra verticalmente contra el avatar: con un nombre
  // de una línea queda a media altura del círculo, con tres lo flanquea.
  const nombre = ajustarNombre(ctx, datos.nombre, TEXTO_ANCHO - 56)
  const altoNombre = nombre.lineas.length * nombre.tam * 1.18
  const altoCategoria = datos.categoria ? 26 + 34 : 0
  const bloque = altoNombre + altoCategoria

  let y = AVATAR_CY - bloque / 2
  ctx.textAlign = 'left'

  ctx.font = fuenteDe(800, nombre.tam)
  ctx.fillStyle = NAVY
  ctx.letterSpacing = '-1px'
  nombre.lineas.forEach((linea, i) => {
    y += nombre.tam * 1.18
    ctx.fillText(linea, TEXTO_X, y)
    // La palomita cuelga de la última línea, pegada a donde termina el texto.
    if (i === nombre.lineas.length - 1 && datos.verificado) {
      const tamIcono = nombre.tam * 0.72
      const x = TEXTO_X + ctx.measureText(linea).width + 16
      const iconoY = y - tamIcono * 0.9
      dibujarIcono(ctx, ICONO_ESCUDO, x, iconoY, tamIcono, { fill: '#2563eb' })
      dibujarIcono(ctx, ICONO_PALOMA, x, iconoY, tamIcono, { fill: '#fff' })
    }
  })
  ctx.letterSpacing = '0px'

  if (datos.categoria) {
    y += 26 + 34
    ctx.font = fuenteDe(600, 34)
    ctx.fillStyle = NARANJA
    ctx.fillText(datos.categoria, TEXTO_X, y)
  }

  // El anuncio: lo que la pieza tiene que dejar en quien no conoce Vichente.
  // Los municipios van con nombre propio porque son el gancho — quien vive en
  // Súchil se detiene al leer Súchil, no al leer "tu rancho".
  // Van encima de donde arranca el skyline: sobre los edificios el texto pierde
  // contraste y la línea de municipios queda cortada por las torres.
  ctx.textAlign = 'center'
  ctx.font = fuenteDe(800, 46)
  ctx.fillStyle = NAVY
  ctx.fillText('LA NUEVA APP DE TU RANCHO', ANCHO / 2, 852)

  ctx.font = fuenteDe(600, 27)
  ctx.fillStyle = NARANJA
  ctx.letterSpacing = '0.5px'
  ctx.fillText(MUNICIPIOS, ANCHO / 2, 898)
  ctx.letterSpacing = '0px'

  dibujarBarra(ctx)
}
