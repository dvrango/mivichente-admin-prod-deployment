// Tarjeta de sellos en el panel del dueño (mikitasks w26gamoh8): qué token sale
// de un QR, qué pantalla del mockup v4 toca y qué texto lleva cada error. Sin
// estado y sin `server-only`: lo usan las server actions y el flujo de cliente.
//
// La DB es la dueña de las reglas. `owner_get_stamp_card`, `owner_add_stamp` y
// `owner_redeem_stamp_card` (`20261105120000_physical_customer_cards`) deciden
// si la tarjeta es de un negocio del dueño, si ya recibió el sello de hoy y si
// se puede canjear. Aquí solo se traduce su respuesta a pantallas.

/** Lo que devuelven las tres funciones del dueño, en camelCase. */
export type StampCardState = {
  /** La vuelta abierta; null si el cliente todavía no tiene una. */
  cardId: string | null
  businessId: string
  businessName: string
  /** El negocio está activo y tiene la tarjeta prendida. */
  programActive: boolean
  /** Premio de la vuelta abierta, sin «un» («frappé gratis»). */
  reward: string | null
  stampsRequired: number
  stamps: number
  isFull: boolean
  stampedToday: boolean
  /** La DB decide si este negocio conserva el límite de un sello diario. */
  dailyLimitApplies: boolean
  lastRedeemedAt: string | null
}

/** Errores que las funciones del dueño levantan con `raise exception`. */
export const STAMP_CARD_DB_ERRORS = [
  'not_a_card',
  'not_your_business',
  'card_not_linked',
  'stamp_card_not_available',
  'already_stamped_today',
  'card_full',
  'already_redeemed',
  'card_not_full',
  'invalid_stamp_operation',
] as const

export type StampCardDbError = (typeof STAMP_CARD_DB_ERRORS)[number]

/** `unknown`: la DB respondió algo que no es una regla de la tarjeta. */
export type StampCardError = StampCardDbError | 'unknown'

export type StampCardResult =
  | { ok: true; card: StampCardState }
  | { ok: false; error: StampCardError }

export function stampCardErrorOf(message: string | undefined | null): StampCardError {
  const m = (message ?? '').trim()
  return (STAMP_CARD_DB_ERRORS as readonly string[]).includes(m)
    ? (m as StampCardDbError)
    : 'unknown'
}

/** 18 bytes en base64url son 24 caracteres. Mismo margen que `pareceToken` de la landing. */
export const CARD_TOKEN = /^[A-Za-z0-9_-]{16,64}$/

const CARD_HOSTS = new Set(['vichente.com', 'www.vichente.com'])

/**
 * El token de la tarjeta que leyó la cámara, o null si el QR no es una tarjeta.
 *
 * La digital (`landing/src/lib/qr-de-la-tarjeta.ts`) y la física (`urlTarjetaFisica`)
 * codifican la misma forma: `https://vichente.com/t/{token}`. El QR del
 * mostrador (`/{slug}/tarjeta`) y el del menú también son de vichente.com, así
 * que no basta con tomar el último segmento de cualquier URL: se exige `/t/` y
 * nada más. Lo que no cumple es E2 sin preguntarle a la DB.
 */
export function cardTokenFromScan(text: string): string | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !CARD_HOSTS.has(url.hostname)) return null
  const match = /^\/t\/([^/]+)\/?$/.exec(url.pathname)
  if (!match) return null
  let token: string
  try {
    token = decodeURIComponent(match[1])
  } catch {
    return null
  }
  return CARD_TOKEN.test(token) ? token : null
}

/**
 * Si el panel enseña la entrada «Tarjeta de sellos» (decisiones del usuario,
 * 2026-11-06): con el programa prendido, o apagado mientras quede algún premio
 * ganado sin canjear, solo para entregarlo. Un snapshot viejo sin las llaves
 * (admin desplegado antes del `db:push`) no la enseña. Solo decide qué se ve:
 * quién sella o canjea lo decide la DB en cada llamada.
 */
export function showsStampCardEntry(b: {
  is_active: boolean
  stamp_card_active?: boolean
  stamp_card_pending_rewards?: number
}): boolean {
  if (b.is_active && b.stamp_card_active === true) return true
  return (b.stamp_card_pending_rewards ?? 0) > 0
}

/** Qué pantalla del flujo toca después de leer una tarjeta. */
export type ScanScreen = 'leida' | 'llena' | 'ya_sellada' | 'apagada'

/**
 * Una tarjeta llena se canjea aunque el programa esté apagado: el premio ya es
 * del cliente, la landing se lo sigue enseñando como ganado y
 * `owner_redeem_stamp_card` no revisa el programa. Sin llenar, con el programa
 * apagado ya no se puede sellar (E8). Con el sello de hoy, sale E4 de una vez en
 * vez de ofrecer un botón que va a fallar.
 */
export function screenAfterScan(card: StampCardState): ScanScreen {
  if (card.isFull) return 'llena'
  if (!card.programActive) return 'apagada'
  if (card.dailyLimitApplies && card.stampedToday) return 'ya_sellada'
  return 'leida'
}

/** Si se canjeó mientras faltaba la respuesta, el sello pertenece a otra vuelta.
 * La lectura inicial puede no tener cardId: canje con programa apagado y luego
 * reactivado. En ese caso también hay que comparar el último canje.
 */
export function sameStampRound(before: StampCardState, after: StampCardState): boolean {
  return (
    (!before.cardId || before.cardId === after.cardId) &&
    before.lastRedeemedAt === after.lastRedeemedAt
  )
}

/** «frappé gratis» → «Frappé gratis», para el título de D3. */
export function rewardTitle(reward: string | null): string {
  const r = (reward ?? '').trim() || 'premio'
  return r.charAt(0).toLocaleUpperCase('es-MX') + r.slice(1)
}

export function rewardText(reward: string | null): string {
  return (reward ?? '').trim() || 'premio'
}

/** El nombre del negocio con guiones que no parten la línea («K‑fféss»), como pide el mockup. */
export function unbreakableName(name: string): string {
  return name.replace(/-/g, '‑')
}

const TZ = 'America/Mexico_City'

function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** La línea de E3: «Se entregó hoy a las 13:42.» o «Se entregó el 5 nov a las 13:42.». */
export function redeemedLine(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Ya se entregó antes.'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'Ya se entregó antes.'
  const hora = at.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  })
  if (dayKey(at) === dayKey(now)) return `Se entregó hoy a las ${hora}.`
  const dia = at
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: TZ })
    .replace('.', '')
  return `Se entregó el ${dia} a las ${hora}.`
}

/** Las pantallas de error del mockup (E1 a E7) más E8, con la misma plantilla. */
export type ErrorScreen =
  | 'otro_negocio' // E1
  | 'no_es_tarjeta' // E2
  | 'ya_canjeado' // E3
  | 'ya_sellada' // E4
  | 'sin_conexion_sello' // E5
  | 'sin_conexion_canje' // E5, al canjear
  | 'sin_conexion_lectura' // E5, al leer
  | 'camara' // E6
  | 'no_activada' // E7
  | 'apagada' // E8
  | 'desconocido'

export type ErrorCopy = {
  title: string
  line: string
  /** Texto del botón principal. */
  primary: string
  /** El principal reintenta lo que falló en vez de volver a la cámara. */
  retries: boolean
  /** El principal abre WhatsApp a Vichente (E8). */
  whatsapp?: boolean
}

export function errorCopy(
  screen: ErrorScreen,
  ctx: { businessName: string; redeemedAt?: string | null; now?: Date },
): ErrorCopy {
  const escanear = 'Escanear otra vez'
  switch (screen) {
    case 'otro_negocio':
      return {
        title: `Esta tarjeta no es de ${unbreakableName(ctx.businessName)}`,
        line: 'No se hizo ningún cambio.',
        primary: escanear,
        retries: false,
      }
    case 'no_es_tarjeta':
      return {
        title: 'Este código no es una tarjeta',
        line: 'Pídele al cliente que abra su tarjeta.',
        primary: escanear,
        retries: false,
      }
    case 'ya_canjeado':
      return {
        title: 'Este premio ya se canjeó',
        line: redeemedLine(ctx.redeemedAt ?? null, ctx.now),
        primary: escanear,
        retries: false,
      }
    case 'ya_sellada':
      return {
        title: 'Ya recibió su sello de hoy',
        line: 'Puede recibir otro mañana.',
        primary: escanear,
        retries: false,
      }
    case 'sin_conexion_sello':
      return {
        title: 'No se pudo confirmar el sello',
        line: 'Intenta otra vez para comprobarlo.',
        primary: 'Intentar otra vez',
        retries: true,
      }
    case 'sin_conexion_canje':
      return {
        title: 'No se canjeó el premio',
        line: 'No hay conexión. Intenta otra vez.',
        primary: 'Intentar otra vez',
        retries: true,
      }
    case 'sin_conexion_lectura':
      return {
        title: 'No se leyó la tarjeta',
        line: 'No hay conexión. Intenta otra vez.',
        primary: 'Intentar otra vez',
        retries: true,
      }
    case 'camara':
      return {
        title: 'No se pudo abrir la cámara',
        line: 'Permite la cámara en tu navegador.',
        primary: 'Intentar otra vez',
        retries: true,
      }
    case 'no_activada':
      return {
        title: 'Esta tarjeta no está activada',
        line: 'Pídele al cliente que la escanee con su celular.',
        primary: escanear,
        retries: false,
      }
    case 'apagada':
      return {
        title: 'Tu tarjeta de sellos está apagada',
        line: 'No se dio el sello. Escríbenos si la quieres prender.',
        primary: 'Escribir a Vichente',
        retries: false,
        whatsapp: true,
      }
    case 'desconocido':
      return {
        title: 'Algo falló',
        line: 'No se hizo ningún cambio. Intenta otra vez.',
        primary: 'Intentar otra vez',
        retries: true,
      }
  }
}

/** De un error de la DB a su pantalla. `card_full` y `card_not_full` no tienen: se vuelve a leer. */
export function errorScreenOf(error: StampCardError): ErrorScreen | null {
  switch (error) {
    case 'not_your_business':
      return 'otro_negocio'
    case 'not_a_card':
      return 'no_es_tarjeta'
    case 'card_not_linked':
      return 'no_activada'
    case 'already_redeemed':
      return 'ya_canjeado'
    case 'already_stamped_today':
      return 'ya_sellada'
    case 'stamp_card_not_available':
      return 'apagada'
    case 'card_full':
    case 'card_not_full':
      return null
    case 'unknown':
    case 'invalid_stamp_operation':
      return 'desconocido'
  }
}
