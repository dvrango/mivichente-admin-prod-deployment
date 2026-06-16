const LOCALE = 'es-MX'

/** Fecha larga en español MX, ej: "16 de junio de 2026". */
export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Fecha corta en español MX, ej: "16/06/2026". */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(LOCALE)
}
