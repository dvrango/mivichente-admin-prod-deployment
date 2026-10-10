import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_REWARD_BENEFIT_MAX,
  feedbackRewardLastDay,
  parseFeedbackRewardForm,
} from './feedback-reward'

function fd(values: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(values)) data.set(k, v)
  return data
}

describe('formulario de opiniones con descuento', () => {
  it('prendido sin descuento no pasa', () => {
    expect(parseFeedbackRewardForm(fd({ active: 'on', benefit: '', days: '30' })).success).toBe(
      false,
    )
    expect(parseFeedbackRewardForm(fd({ active: 'on', benefit: '   ', days: '30' })).success).toBe(
      false,
    )
  })

  it('apagado sin descuento sí pasa y guarda null', () => {
    const parsed = parseFeedbackRewardForm(fd({ benefit: '', days: '30' }))
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toEqual({ active: false, benefit: null, days: 30 })
  })

  it('prendido con descuento recorta los espacios', () => {
    const parsed = parseFeedbackRewardForm(fd({ active: 'on', benefit: '  10%  ', days: ' 15 ' }))
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toEqual({ active: true, benefit: '10%', days: 15 })
  })

  it('rechaza un descuento más largo que el de la DB', () => {
    const max = 'x'.repeat(FEEDBACK_REWARD_BENEFIT_MAX)
    expect(parseFeedbackRewardForm(fd({ active: 'on', benefit: max, days: '30' })).success).toBe(
      true,
    )
    expect(
      parseFeedbackRewardForm(fd({ active: 'on', benefit: `${max}x`, days: '30' })).success,
    ).toBe(false)
  })

  it.each(['0', '366', '1.5', '-3', 'treinta', ''])('rechaza %o días', (days) => {
    expect(parseFeedbackRewardForm(fd({ active: 'on', benefit: '10%', days })).success).toBe(false)
  })

  it.each(['1', '365'])('acepta %o días', (days) => {
    expect(parseFeedbackRewardForm(fd({ active: 'on', benefit: '10%', days })).success).toBe(true)
  })
})

describe('último día del descuento', () => {
  // submit_business_feedback vence al empezar hoy + días + 1 (hora de Durango).
  it('con 30 días, una opinión del 10 de octubre vale hasta el 9 de noviembre', () => {
    expect(feedbackRewardLastDay('30', '2026-10-10')).toBe('9 de noviembre de 2026')
  })

  it('con 1 día vale hoy y mañana', () => {
    expect(feedbackRewardLastDay('1', '2026-12-31')).toBe('1 de enero de 2027')
  })

  it('días inválidos no dan fecha', () => {
    expect(feedbackRewardLastDay('', '2026-10-10')).toBeNull()
    expect(feedbackRewardLastDay('0', '2026-10-10')).toBeNull()
  })
})
