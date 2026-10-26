const DAY_MS = 24 * 60 * 60 * 1000

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

export function formatMoney(cents: number): string {
  return money.format(cents / 100)
}

// `day` viene de SQL como fecha sin hora (ya es el día local de Monterrey), así
// que se formatea en UTC para que el navegador o el server no lo corran de día.
const shortDay = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export function formatDay(day: string): string {
  return shortDay.format(new Date(`${day}T00:00:00Z`))
}

const localDay = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Monterrey',
})

// `en-CA` da `YYYY-MM-DD`, que se puede restar como fecha sin hora.
const isoLocalDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' })

/** Días de calendario (de Durango) entre `iso` y `now`: ayer a las 23:00 ya es 1. */
export function daysSince(iso: string, now: number): number {
  const a = Date.parse(isoLocalDay.format(new Date(iso)))
  const b = Date.parse(isoLocalDay.format(new Date(now)))
  return Math.round((b - a) / DAY_MS)
}

/** "hoy", "ayer" o "hace N días", más la fecha local para no tener que contar. */
export function formatLastSeen(iso: string, now: number): string {
  const days = daysSince(iso, now)
  const date = localDay.format(new Date(iso))
  if (days <= 0) return `hoy · ${date}`
  if (days === 1) return `ayer · ${date}`
  return `hace ${days} días · ${date}`
}
