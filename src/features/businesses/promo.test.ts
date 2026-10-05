import { describe, expect, it } from 'vitest'
import { PROMO_TITLE_MAX, parsePromoForm, promoStatus, todayInDurango } from './promo'

function fd(values: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(values)) data.set(k, v)
  return data
}

describe('formulario de la promoción', () => {
  it('prendida sin título no pasa', () => {
    const parsed = parsePromoForm(fd({ active: 'on', title: '   ', body: '', ends_at: '' }))
    expect(parsed.success).toBe(false)
  })

  it('apagada sin título sí pasa y guarda nulls', () => {
    const parsed = parsePromoForm(fd({ title: '', body: '', ends_at: '' }))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ active: false, title: null, body: null, ends_at: null })
    }
  })

  it('conserva los renglones en blanco del cuerpo', () => {
    const body = 'Sodas italianas al 2x1\n- Zarzamora\n\nFrappés al 3x2\n- Moka blanco'
    const parsed = parsePromoForm(
      fd({ active: 'on', title: 'Promo', body: `\n${body}\n\n`, ends_at: '' }),
    )
    expect(parsed.success && parsed.data.body).toBe(body)
  })

  it('los saltos \\r\\n del navegador cuentan como uno', () => {
    const parsed = parsePromoForm(fd({ title: 'Promo', body: 'A\r\n- B\r\n\r\nC', ends_at: '' }))
    expect(parsed.success && parsed.data.body).toBe('A\n- B\n\nC')
    const lleno = Array.from({ length: 1000 }, () => 'x').join('\r\n')
    expect(parsePromoForm(fd({ title: 'Promo', body: lleno, ends_at: '' })).success).toBe(true)
  })

  it('rechaza una fecha que no existe', () => {
    expect(parsePromoForm(fd({ title: 'Promo', body: '', ends_at: '2026-02-31' })).success).toBe(
      false,
    )
    expect(parsePromoForm(fd({ title: 'Promo', body: '', ends_at: '2026-10-10' })).success).toBe(
      true,
    )
  })

  it('rechaza un título largo y una fecha mal formada', () => {
    expect(
      parsePromoForm(fd({ title: 'x'.repeat(PROMO_TITLE_MAX + 1), body: '', ends_at: '' })).success,
    ).toBe(false)
    expect(parsePromoForm(fd({ title: 'Promo', body: '', ends_at: '10/10/2026' })).success).toBe(
      false,
    )
  })
})

describe('estado de la promoción', () => {
  const base = { promo_active: true, promo_title: 'Promo', promo_ends_at: null }

  it.each([
    [{ ...base, promo_title: null }, 'none'],
    [{ ...base, promo_active: false }, 'off'],
    [base, 'live'],
    [{ ...base, promo_ends_at: '2026-10-10' }, 'live'],
    [{ ...base, promo_ends_at: '2026-10-09' }, 'expired'],
  ] as const)('%o → %s', (promo, status) => {
    expect(promoStatus(promo, '2026-10-10')).toBe(status)
  })

  it('el día cambia a medianoche de Durango, no de UTC', () => {
    // 2026-10-11 03:00 UTC = 2026-10-10 21:00 en Durango.
    expect(todayInDurango(new Date('2026-10-11T03:00:00Z'))).toBe('2026-10-10')
    expect(todayInDurango(new Date('2026-10-11T06:00:00Z'))).toBe('2026-10-11')
  })
})
