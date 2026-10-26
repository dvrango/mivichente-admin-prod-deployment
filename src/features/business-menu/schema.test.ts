import { describe, expect, it } from 'vitest'
import { menuItemCreateSchema, menuOptionSchema, menuVariantSchema } from './schema'

// Los tres precios del editor (platillo, tamaño y extra) aceptan el formato en
// que se copia de un menú impreso. El caso que motivó esto: "$15" en un extra
// llegaba como "" y se guardaba como opción sin costo, sin ningún aviso.

describe('precio de un extra', () => {
  it.each(['$15', '15', '15.00', ' $ 15 ', '15 $'])('"%s" se guarda como 15', (raw) => {
    const parsed = menuOptionSchema.safeParse({ name: 'shot', price_delta: raw })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.price_delta).toBe(15)
  })

  it('vacío sigue siendo sin costo', () => {
    const parsed = menuOptionSchema.safeParse({ name: 'shot', price_delta: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.price_delta).toBe(0)
  })

  it('con coma no se adivina: se rechaza con mensaje', () => {
    const parsed = menuOptionSchema.safeParse({ name: 'shot', price_delta: '15,50' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toMatch(/sin comas/)
  })

  it('texto que no es número se rechaza, no se vuelve 0', () => {
    expect(menuOptionSchema.safeParse({ name: 'shot', price_delta: 'quince' }).success).toBe(false)
  })
})

describe('precio de un tamaño', () => {
  it('"$90" se guarda como 90', () => {
    const parsed = menuVariantSchema.safeParse({ name: 'chica', price: '$90' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.price).toBe(90)
  })

  it('"$" solo cuenta como vacío y pide el precio', () => {
    const parsed = menuVariantSchema.safeParse({ name: 'chica', price: '$' })
    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(parsed.error.issues[0]?.message).toBe('Cada tamaño necesita su precio.')
  })
})

describe('precio del platillo', () => {
  it('"$40.50" se guarda como 40.5', () => {
    const parsed = menuItemCreateSchema.safeParse({ name: 'Americano', price: '$40.50' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.price).toBe(40.5)
  })

  it('vacío sigue siendo sin precio público', () => {
    const parsed = menuItemCreateSchema.safeParse({ name: 'Pastel por encargo', price: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.price).toBeNull()
  })

  it('"1,500" se rechaza con mensaje en vez de guardarse mal', () => {
    const parsed = menuItemCreateSchema.safeParse({ name: 'Paquete', price: '1,500' })
    expect(parsed.success).toBe(false)
  })
})
