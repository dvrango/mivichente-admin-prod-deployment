import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/queries'

const WINDOW_DAYS = 7
// Semanas de historia para la tendencia. 6 alcanza para ver si sube/baja/se
// estanca sin volverse ruido — con este volumen no tiene caso ver más atrás.
const WEEKS = 6
const DAY_MS = 24 * 60 * 60 * 1000

export type ChannelCounts = { call: number; whatsapp: number; maps: number }
export type SourceCounts = { app: number; landing: number }

type WeekStats = {
  uniqueDevices: number
  returningDevices: number
  searches: number
  zeroResultSearches: number
  businessTaps: number
  contacts: number
  contactsByChannel: ChannelCounts
  contactsBySource: SourceCounts
}

export type WeeklyMetrics = {
  windowDays: number
  since: string
  current: WeekStats & { topZeroResultQueries: { query: string; count: number }[] }
  previous: WeekStats
  // Semanal, de más vieja a más nueva. El último elemento es `current`.
  series: {
    uniqueDevices: number
    searches: number
    zeroResultSearches: number
    businessTaps: number
    contacts: number
  }[]
}

/**
 * La agregación vive en SQL (`admin_weekly_metrics` y
 * `admin_top_zero_result_queries`, migración 20261002120000). Antes se bajaban
 * las filas crudas de 6 semanas y se agregaba aquí, pero PostgREST corta en
 * 1000 filas sin avisar: cuando `search_events` pasó ese tope, las semanas
 * recientes salían en 0 (mikitasks `su4z8tm09`). La semántica —semanas hacia
 * atrás desde ahora, días en UTC, "regresa" = 2+ días en la semana, exclusión
 * de `excluded_devices`— está documentada en la migración. Desde 20261026120000
 * los devices cuentan actividad en búsquedas, taps, contactos y el embudo del
 * pedido, no solo búsquedas (mikitasks `es1d67kyq`).
 *
 * Por qué service role y no el cliente del usuario (revisado 2026-09-18,
 * mikitasks `eantgj6l5` y `06yzbwbcc`): las dos funciones solo dan `execute`
 * a `service_role`, y las tablas que leen no dan SELECT a clientes. Con el
 * cliente normal la llamada falla, así que el service role no es un atajo: hoy
 * es el único camino.
 *
 * La consecuencia es que esta función corre por fuera de RLS y `db:rls:check`
 * no la cubre, así que el `requireAdmin()` va DENTRO de la función y no solo en
 * `metrics/layout.tsx`: el layout da el redirect temprano, pero confiar la
 * autorización a un módulo de arriba deja el único camino sin RLS del admin a
 * merced de que el próximo consumidor se acuerde. No cuesta query extra,
 * `getCurrentProfile` está memoizado por request con `cache()`.
 *
 * La alternativa —que las funciones chequen `is_admin()` adentro y usar el
 * cliente de siempre— metería la regla donde vive el resto del proyecto y la
 * volvería verificable por el harness. Se dejó fuera a propósito: habría
 * cambiado el modelo de autorización en el mismo cambio que arreglaba un
 * conteo.
 */
export async function getWeeklyMetrics(): Promise<WeeklyMetrics> {
  await requireAdmin()
  const supabase = createAdminClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const sinceIso = new Date(now - WEEKS * WINDOW_DAYS * DAY_MS).toISOString()

  // Mismo `p_now` en las dos llamadas para que el top y la semana 0 cubran
  // exactamente la misma ventana.
  const [weekly, topZero] = await Promise.all([
    supabase.rpc('admin_weekly_metrics', {
      p_now: nowIso,
      p_weeks: WEEKS,
      p_window_days: WINDOW_DAYS,
    }),
    supabase.rpc('admin_top_zero_result_queries', {
      p_now: nowIso,
      p_window_days: WINDOW_DAYS,
      p_limit: 10,
    }),
  ])

  if (weekly.error) throw weekly.error
  if (topZero.error) throw topZero.error

  // La función siempre devuelve WEEKS filas ordenadas por week_index (0 =
  // actual), incluidas las semanas sin eventos.
  const weekStats: WeekStats[] = (weekly.data ?? []).map((w) => ({
    uniqueDevices: w.unique_devices,
    returningDevices: w.returning_devices,
    searches: w.searches,
    zeroResultSearches: w.zero_result_searches,
    businessTaps: w.business_taps,
    contacts: w.contacts,
    contactsByChannel: {
      call: w.contacts_call,
      whatsapp: w.contacts_whatsapp,
      maps: w.contacts_maps,
    },
    contactsBySource: { app: w.contacts_app, landing: w.contacts_landing },
  }))
  if (weekStats.length !== WEEKS) {
    throw new Error(
      `admin_weekly_metrics devolvió ${weekStats.length} semanas, se esperaban ${WEEKS}`,
    )
  }

  const topZeroResultQueries = (topZero.data ?? []).map((row) => ({
    query: row.query,
    count: row.searches,
  }))

  return {
    windowDays: WINDOW_DAYS,
    since: sinceIso,
    current: { ...weekStats[0], topZeroResultQueries },
    previous: weekStats[1],
    series: weekStats
      .slice()
      .reverse()
      .map((w) => ({
        uniqueDevices: w.uniqueDevices,
        searches: w.searches,
        zeroResultSearches: w.zeroResultSearches,
        businessTaps: w.businessTaps,
        contacts: w.contacts,
      })),
  }
}

export type FunnelCounts = {
  viewed: number
  added: number
  checkout: number
  whatsapp: number
  intents: number
  intentsCents: number
}

export type BusinessFunnel = {
  businessId: string
  businessName: string
  current: FunnelCounts
  previous: FunnelCounts
  intentsLong: number
  intentsCentsLong: number
}

export type OrderQrMetrics = {
  /** El `p_now` de las cuatro consultas, en ms. "Hace N días" se mide contra él. */
  now: number
  windowDays: number
  longDays: number
  /** Devices distintos en todo el embudo: no es la suma de `byBusiness`. */
  total: Omit<BusinessFunnel, 'businessId' | 'businessName'>
  byBusiness: BusinessFunnel[]
  /** Día local (America/Monterrey), de más viejo a más nuevo, con los días vacíos en 0. */
  daily: { day: string; menuDevices: number; intents: number; intentsCents: number }[]
  qrByChannel: { channel: string; scans: number; scansPrevious: number }[]
  menuQrByBusiness: {
    businessId: string
    businessName: string
    scans: number
    scansPrevious: number
    lastScanAt: string
  }[]
}

const LONG_DAYS = 30

/**
 * Piloto de pedidos y QR (mikitasks `tjc3k2h1k`). Las cuatro funciones de la
 * migración 20261026130000 agregan en SQL por la misma razón que las de la
 * Etapa 1, y la semántica (dedupe de intenciones en 30 min, día local en la
 * serie, exclusión de `excluded_devices`) está documentada ahí.
 *
 * Mismo modelo de autorización que `getWeeklyMetrics()`: service role, porque
 * las funciones solo dan `execute` a `service_role`, y `requireAdmin()` aquí
 * adentro porque es el único candado de este camino que vive en el admin. Estos
 * datos dicen cuánto vende cada negocio.
 */
export async function getOrderQrMetrics(): Promise<OrderQrMetrics> {
  await requireAdmin()
  const supabase = createAdminClient()
  // Un solo `p_now` para que las cuatro lecturas cubran la misma ventana.
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const [funnel, daily, channels, menuQr] = await Promise.all([
    supabase.rpc('admin_order_funnel', {
      p_now: nowIso,
      p_window_days: WINDOW_DAYS,
      p_long_days: LONG_DAYS,
    }),
    supabase.rpc('admin_order_daily', { p_now: nowIso, p_days: LONG_DAYS }),
    supabase.rpc('admin_qr_scans_by_channel', { p_now: nowIso, p_window_days: WINDOW_DAYS }),
    supabase.rpc('admin_menu_qr_by_business', { p_now: nowIso, p_window_days: WINDOW_DAYS }),
  ])

  if (funnel.error) throw funnel.error
  if (daily.error) throw daily.error
  if (channels.error) throw channels.error
  if (menuQr.error) throw menuQr.error

  const rows = (funnel.data ?? []).map((r) => ({
    // El generador de tipos no sabe que la fila de total trae estas columnas en
    // null (`grouping sets` en la función).
    businessId: r.business_id as string | null,
    businessName: r.business_name as string | null,
    current: {
      viewed: r.viewed,
      added: r.added,
      checkout: r.checkout,
      whatsapp: r.whatsapp,
      intents: r.intents,
      intentsCents: r.intents_cents,
    },
    previous: {
      viewed: r.viewed_prev,
      added: r.added_prev,
      checkout: r.checkout_prev,
      whatsapp: r.whatsapp_prev,
      intents: r.intents_prev,
      intentsCents: r.intents_cents_prev,
    },
    intentsLong: r.intents_long,
    intentsCentsLong: r.intents_cents_long,
  }))

  // La función siempre devuelve la fila de total (business_id null), aunque no
  // haya eventos.
  const totalRow = rows.find((r) => r.businessId === null)
  if (!totalRow) throw new Error('admin_order_funnel no devolvió la fila de total')
  const { current, previous, intentsLong, intentsCentsLong } = totalRow

  return {
    now,
    windowDays: WINDOW_DAYS,
    longDays: LONG_DAYS,
    total: { current, previous, intentsLong, intentsCentsLong },
    byBusiness: rows
      .filter((r) => r.businessId !== null)
      .map((r) => ({ ...r, businessId: r.businessId ?? '', businessName: r.businessName ?? '—' })),
    daily: (daily.data ?? []).map((d) => ({
      day: d.day,
      menuDevices: d.menu_devices,
      intents: d.intents,
      intentsCents: d.intents_cents,
    })),
    qrByChannel: (channels.data ?? []).map((c) => ({
      channel: c.channel,
      scans: c.scans,
      scansPrevious: c.scans_prev,
    })),
    menuQrByBusiness: (menuQr.data ?? []).map((q) => ({
      businessId: q.business_id,
      businessName: q.business_name,
      scans: q.scans,
      scansPrevious: q.scans_prev,
      lastScanAt: q.last_scan_at,
    })),
  }
}
