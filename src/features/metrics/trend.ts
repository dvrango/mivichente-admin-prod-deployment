export function trendLabel(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '→ igual que la semana pasada'
  if (previous === 0) return `nuevo (0 → ${current})`
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return '→ igual que la semana pasada'
  const arrow = pct > 0 ? '↑' : '↓'
  // El signo es dirección, no juicio: para "búsquedas sin resultado" subir es
  // malo y para "taps" es bueno — por eso no se pinta de verde/rojo, decide
  // quien lee según qué métrica es.
  return `${arrow} ${Math.abs(pct)}% vs semana pasada`
}
