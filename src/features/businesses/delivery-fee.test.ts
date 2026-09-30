import { describe, expect, it } from 'vitest'
import {
  deliveryFeeSchema,
  deliveryFeeValue,
  initialDeliveryFee,
  parseBusinessForm,
} from './schema'

describe('condición del envío', () => {
  it.each([
    ['confirm', '', null],
    ['free', '', 0],
    ['fixed', '25.75', 25.75],
  ] as const)('guarda %s y lo restaura explícitamente', (mode, amount, fee) => {
    const parsed = deliveryFeeSchema.parse({ mode, amount })
    expect(deliveryFeeValue(parsed)).toBe(fee)
    expect(initialDeliveryFee(fee).mode).toBe(mode)
  })

  it.each(['', '0', '-1', 'NaN', 'Infinity', '1.001', '1e2', '100000000', '25,75', '$25.75'])(
    'rechaza costo fijo inválido: %s',
    (amount) => {
      expect(deliveryFeeSchema.safeParse({ mode: 'fixed', amount }).success).toBe(false)
    },
  )

  it('rechaza un modo desconocido', () => {
    expect(deliveryFeeSchema.safeParse({ mode: '', amount: '' }).success).toBe(false)
  })

  it('omitir el control no borra una tarifa existente', () => {
    const fd = new FormData()
    fd.set('name', 'Restaurante')
    fd.set('primary_category_id', '00000000-0000-4000-8000-000000000001')
    fd.set('phone', '6180000000')
    const parsed = parseBusinessForm(fd)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.delivery).toBeUndefined()
    fd.set('delivery_mode', 'free')
    const free = parseBusinessForm(fd)
    expect(free.success).toBe(true)
    if (free.success) expect(deliveryFeeValue(free.data.delivery!)).toBe(0)
    fd.set('delivery_mode', 'confirm')
    const confirm = parseBusinessForm(fd)
    if (confirm.success) expect(deliveryFeeValue(confirm.data.delivery!)).toBeNull()
    else throw new Error('No acepta por confirmar')
  })
})
