import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/auth/queries'

// device_id de pruebas del propio equipo — se excluye de todos los conteos,
// mismo criterio que usa la Brújula del Producto al leer estas tablas a mano.
const TEST_DEVICE_ID = '76be25ff-1906-45ff-a829-46fbc828eecd'

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

type SearchEventRow = { device_id: string; query: string; result_count: number; created_at: string }
type TapRow = { created_at: string }
type ContactRow = { channel: string; source: string; created_at: string }

function weekIndexOf(createdAt: string, now: number): number {
  // 0 = semana actual (últimos 7 días), WEEKS-1 = la más vieja del rango.
  // Clamp abajo también: una fila con created_at muy cerca de `now` (o el
  // reloj de la DB un poco adelante del de Vercel) puede dar índice negativo.
  return Math.max(
    0,
    Math.min(WEEKS - 1, Math.floor((now - new Date(createdAt).getTime()) / (WINDOW_DAYS * DAY_MS))),
  )
}

function statsForWeek(events: SearchEventRow[], taps: TapRow[], contacts: ContactRow[]): WeekStats {
  const devicesByDate = new Map<string, Set<string>>()
  for (const row of events) {
    const day = row.created_at.slice(0, 10)
    if (!devicesByDate.has(day)) devicesByDate.set(day, new Set())
    devicesByDate.get(day)!.add(row.device_id)
  }
  const daysSeenByDevice = new Map<string, number>()
  for (const devices of devicesByDate.values()) {
    for (const deviceId of devices) {
      daysSeenByDevice.set(deviceId, (daysSeenByDevice.get(deviceId) ?? 0) + 1)
    }
  }

  const zeroResultSearches = events.filter((row) => row.result_count === 0).length

  const contactsByChannel: ChannelCounts = { call: 0, whatsapp: 0, maps: 0 }
  const contactsBySource: SourceCounts = { app: 0, landing: 0 }
  for (const row of contacts) {
    if (row.channel in contactsByChannel) contactsByChannel[row.channel as keyof ChannelCounts] += 1
    if (row.source in contactsBySource) contactsBySource[row.source as keyof SourceCounts] += 1
  }

  return {
    uniqueDevices: daysSeenByDevice.size,
    returningDevices: [...daysSeenByDevice.values()].filter((days) => days >= 2).length,
    searches: events.length,
    zeroResultSearches,
    businessTaps: taps.length,
    contacts: contacts.length,
    contactsByChannel,
    contactsBySource,
  }
}

/**
 * Por qué service role y no el cliente del usuario (revisado 2026-09-11,
 * mikitasks `eantgj6l5`): las tres tablas que lee acá —`search_events`,
 * `search_result_taps`, `business_contacts`— tienen **una sola policy cada una,
 * y es de INSERT**. No existe policy de SELECT para nadie, ni siquiera para
 * admin. Con el cliente normal esto devolvería cero filas siempre, así que el
 * service role no es un atajo: hoy es el único camino.
 *
 * La consecuencia es que esta función corre por fuera de RLS y `db:rls:check`
 * no la cubre, así que el `requireAdmin()` va DENTRO de la función y no solo en
 * `metrics/layout.tsx`: el layout da el redirect temprano, pero confiar la
 * autorización a un módulo de arriba deja el único camino sin RLS del admin a
 * merced de que el próximo consumidor se acuerde. No cuesta query extra,
 * `getCurrentProfile` está memoizado por request con `cache()`.
 *
 * La alternativa —darle SELECT con `is_admin()` a esas tres tablas y usar el
 * cliente de siempre— metería la regla donde vive el resto del proyecto y la
 * volvería verificable por el harness. Cuesta una migración y un `db:push`, y
 * se dejó fuera de este cambio a propósito.
 */
export async function getWeeklyMetrics(): Promise<WeeklyMetrics> {
  await requireAdmin()
  const supabase = createAdminClient()
  const now = Date.now()
  const sinceIso = new Date(now - WEEKS * WINDOW_DAYS * DAY_MS).toISOString()

  const [searchEvents, taps, contacts] = await Promise.all([
    supabase
      .from('search_events')
      .select('device_id, query, result_count, created_at')
      .neq('device_id', TEST_DEVICE_ID)
      .gte('created_at', sinceIso),
    supabase
      .from('search_result_taps')
      .select('created_at')
      .neq('device_id', TEST_DEVICE_ID)
      .gte('created_at', sinceIso),
    supabase
      .from('business_contacts')
      .select('channel, source, created_at')
      .neq('device_id', TEST_DEVICE_ID)
      .gte('created_at', sinceIso),
  ])

  if (searchEvents.error) throw searchEvents.error
  if (taps.error) throw taps.error
  if (contacts.error) throw contacts.error

  const events = (searchEvents.data ?? []) as SearchEventRow[]
  const tapRows = (taps.data ?? []) as TapRow[]
  const contactRows = (contacts.data ?? []) as ContactRow[]

  const buckets: { events: SearchEventRow[]; taps: TapRow[]; contacts: ContactRow[] }[] =
    Array.from({ length: WEEKS }, () => ({ events: [], taps: [], contacts: [] }))
  for (const row of events) buckets[weekIndexOf(row.created_at, now)].events.push(row)
  for (const row of tapRows) buckets[weekIndexOf(row.created_at, now)].taps.push(row)
  for (const row of contactRows) buckets[weekIndexOf(row.created_at, now)].contacts.push(row)

  const weekStats = buckets.map((b) => statsForWeek(b.events, b.taps, b.contacts))

  const zeroResultCounts = new Map<string, number>()
  for (const row of buckets[0].events) {
    if (row.result_count !== 0) continue
    const key = row.query.trim().toLowerCase()
    if (!key) continue
    zeroResultCounts.set(key, (zeroResultCounts.get(key) ?? 0) + 1)
  }
  const topZeroResultQueries = [...zeroResultCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }))

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
