import { describe, expect, it } from 'vitest'
import { STAMP_CARD_REWARD_MAX, parseStampCardForm } from './stamp-card'

function fd(values: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(values)) data.set(k, v)
  return data
}

describe('formulario de la tarjeta de sellos', () => {
  it('prendido con sellos y premio pasa y recorta espacios', () => {
    const parsed = parseStampCardForm(
      fd({ active: 'on', stampsRequired: ' 8 ', reward: '  frappé gratis ' }),
    )
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ active: true, stampsRequired: 8, reward: 'frappé gratis' })
    }
  })

  it('prendido sin premio o sin sellos no pasa', () => {
    expect(
      parseStampCardForm(fd({ active: 'on', stampsRequired: '8', reward: '  ' })).success,
    ).toBe(false)
    expect(
      parseStampCardForm(fd({ active: 'on', stampsRequired: '', reward: 'café' })).success,
    ).toBe(false)
  })

  it('apagado y vacío pasa y guarda null', () => {
    const parsed = parseStampCardForm(fd({ stampsRequired: '', reward: '' }))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ active: false, stampsRequired: null, reward: null })
    }
  })

  it.each(['1', '21', '0', '-3', '2.5', 'ocho'])('rechaza %s sellos (la DB pide 2 a 20)', (bad) => {
    expect(parseStampCardForm(fd({ stampsRequired: bad, reward: 'café' })).success).toBe(false)
  })

  it.each(['2', '20'])('acepta %s sellos', (ok) => {
    expect(parseStampCardForm(fd({ stampsRequired: ok, reward: 'café' })).success).toBe(true)
  })

  it('el premio no pasa del límite de la DB', () => {
    const largo = 'x'.repeat(STAMP_CARD_REWARD_MAX + 1)
    expect(
      parseStampCardForm(fd({ active: 'on', stampsRequired: '8', reward: largo })).success,
    ).toBe(false)
  })
})
