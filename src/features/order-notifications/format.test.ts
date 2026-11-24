import { describe, expect, it } from 'vitest'
import {
  afterChangeMessages,
  buttonPayload,
  displayPhone,
  itemsLine,
  money,
  newOrderTemplate,
  nextButtons,
  oneLine,
  parseButtonPayload,
  parseCallbackData,
  totalText,
  unchangedMessage,
  whereLine,
} from './format'
import { ORDER_ID, makeOrder } from './test-fixtures'
import type { OrderItem, OutgoingMessage } from './types'

// What Meta rejects in a template parameter (error 132018).
const META_FORBIDDEN = /[\n\t]| {5,}/

function templateOf(message: OutgoingMessage) {
  if (message.kind !== 'template') throw new Error('not a template')
  return message
}

describe('button payloads', () => {
  it('round-trips the order id and the action', () => {
    expect(parseButtonPayload(buttonPayload(ORDER_ID, 'on_the_way'))).toEqual({
      orderId: ORDER_ID,
      action: 'on_the_way',
    })
  })

  it('rejects anything that is not one of our payloads', () => {
    expect(parseButtonPayload(null)).toBeNull()
    expect(parseButtonPayload('Aceptar')).toBeNull()
    expect(parseButtonPayload(`order:${ORDER_ID}:delivered`)).toBeNull()
    expect(parseButtonPayload(`order:not-a-uuid:accepted`)).toBeNull()
    expect(parseButtonPayload(`order:${ORDER_ID}:accepted:extra`)).toBeNull()
  })

  it('reads the callback data of the template', () => {
    expect(parseCallbackData(`order:${ORDER_ID}`)).toBe(ORDER_ID)
    expect(parseCallbackData('otra-cosa')).toBeNull()
  })
})

describe('pieces', () => {
  it('formats money without zero cents and with thousands', () => {
    expect(money(15200)).toBe('$152')
    expect(money(15250)).toBe('$152.50')
    expect(money(125000)).toBe('$1,250')
    expect(money(5)).toBe('$0.05')
  })

  it('formats the phone so WhatsApp lets the owner tap it', () => {
    expect(displayPhone('6181234567')).toBe('+52 618 123 4567')
    expect(displayPhone(null)).toBe('sin teléfono')
  })

  it('flattens new lines, tabs and runs of spaces', () => {
    expect(oneLine('  a\nb\t\tc     d  ')).toBe('a b c d')
  })

  it('writes the total for each delivery fee case', () => {
    expect(totalText(makeOrder({ paysWith: null }))).toBe('$152 con $20 de envío')
    expect(
      totalText(makeOrder({ deliveryFeeCents: null, totalCents: 13200, paysWith: null })),
    ).toBe('$132 + envío por confirmar')
    expect(totalText(makeOrder({ deliveryFeeCents: 0, totalCents: 13200, paysWith: null }))).toBe(
      '$132 con envío gratis',
    )
    expect(
      totalText(
        makeOrder({ mode: 'pickup', deliveryFeeCents: 0, totalCents: 9600, paysWith: null }),
      ),
    ).toBe('$96')
    expect(totalText(makeOrder())).toBe('$152 con $20 de envío · paga con $200')
    expect(totalText(makeOrder({ paysWith: 'billete de 500' }))).toContain(
      'paga con billete de 500',
    )
  })

  it('joins map link, directions and references in one line', () => {
    expect(whereLine(makeOrder())).toBe(
      'https://maps.google.com/?q=23.73,-103.98 · Entrando por la calle de la iglesia · Referencias: Casa azul, portón negro',
    )
    expect(
      whereLine(makeOrder({ deliveryLat: null, deliveryLng: null, deliveryReferences: null })),
    ).toBe('Entrando por la calle de la iglesia')
  })

  it('cuts a long list of dishes at a whole dish and says how many are left', () => {
    const items: OrderItem[] = Array.from({ length: 30 }, (_, i) => ({
      name: `Platillo número ${i + 1}`,
      variant_name: 'mediano',
      options: [{ group_name: 'Salsa', name: 'Salsa verde' }],
      quantity: 1,
      note: 'bien dorado por favor',
    }))
    const line = itemsLine(items, 600)
    expect(line.length).toBeLessThanOrEqual(600)
    const shown = line.split(' · ').filter((p) => p.startsWith('1×')).length
    expect(line).toMatch(new RegExp(` · y ${30 - shown} más$`))
  })

  it('cuts even a single dish that does not fit', () => {
    const items: OrderItem[] = [
      { name: 'x'.repeat(700), variant_name: null, options: [], quantity: 1, note: null },
      { name: 'Agua', variant_name: null, options: [], quantity: 1, note: null },
    ]
    const line = itemsLine(items, 200)
    expect(line.length).toBeLessThanOrEqual(200)
    expect(line.endsWith(' · y 1 más')).toBe(true)
  })
})

describe('new order template', () => {
  it('fills the delivery template with valid one-line parameters', () => {
    const t = templateOf(newOrderTemplate(makeOrder()))
    expect(t.name).toBe('pedido_domicilio')
    expect(t.headerParams).toEqual({ cliente: 'Ana López' })
    expect(Object.keys(t.bodyParams)).toEqual(['platillos', 'total', 'donde', 'telefono'])
    expect(t.bodyParams.platillos).toBe(
      '2× Americano grande (Leche de almendra, Extra shot) – Nota: sin azúcar · 1× Pan de elote',
    )
    expect(t.bodyParams.telefono).toBe('+52 618 123 4567')
    for (const value of [...Object.values(t.bodyParams), ...Object.values(t.headerParams)]) {
      expect(value).not.toMatch(META_FORBIDDEN)
      expect(value.length).toBeGreaterThan(0)
    }
    expect(t.buttonPayloads).toEqual([`order:${ORDER_ID}:accepted`, `order:${ORDER_ID}:rejected`])
    expect(t.callbackData).toBe(`order:${ORDER_ID}`)
  })

  it('uses the pickup template without a place', () => {
    const t = templateOf(
      newOrderTemplate(
        makeOrder({
          mode: 'pickup',
          deliveryFeeCents: 0,
          deliveryLat: null,
          deliveryLng: null,
          deliveryDirections: null,
          deliveryReferences: null,
        }),
      ),
    )
    expect(t.name).toBe('pedido_recoger')
    expect(Object.keys(t.bodyParams)).toEqual(['platillos', 'total', 'telefono'])
  })

  it('keeps the header and the whole body inside Meta limits for the biggest order', () => {
    const note = 'ñ\n'.repeat(100)
    const order = makeOrder({
      customerName: 'Nombre Larguísimo De Una Persona Con Muchos Apellidos Y Más',
      items: Array.from({ length: 50 }, () => ({
        name: 'Platillo con nombre largo',
        variant_name: 'familiar',
        options: [{ group_name: 'Extras', name: 'Queso extra' }],
        quantity: 99,
        note,
      })),
      deliveryDirections: 'd'.repeat(300),
      deliveryReferences: 'r'.repeat(200),
      paysWith: 'p'.repeat(40),
    })
    const t = templateOf(newOrderTemplate(order))
    expect(`Pedido a domicilio · ${t.headerParams.cliente}`.length).toBeLessThanOrEqual(60)
    const body =
      'Te pidieron por Vichente:\n\n\nTotal: \nDónde: \n\nPara hablar con el cliente: \n¿Lo aceptas?'
        .length + Object.values(t.bodyParams).join('').length
    expect(body).toBeLessThanOrEqual(1024)
    for (const value of Object.values(t.bodyParams)) expect(value).not.toMatch(META_FORBIDDEN)
  })
})

describe('messages after a tap', () => {
  it('offers the next step with a button title Meta accepts', () => {
    for (const status of ['pending', 'accepted', 'preparing'] as const) {
      for (const mode of ['delivery', 'pickup'] as const) {
        for (const b of nextButtons(makeOrder({ mode }), status)) {
          expect(b.title.length).toBeLessThanOrEqual(20)
        }
      }
    }
    expect(nextButtons(makeOrder(), 'accepted')[0].title).toBe('Lo estoy preparando')
    expect(nextButtons(makeOrder(), 'preparing')[0].title).toBe('Ya salió')
    expect(nextButtons(makeOrder({ mode: 'pickup' }), 'preparing')[0].title).toBe('Ya está listo')
    expect(nextButtons(makeOrder(), 'on_the_way')).toEqual([])
    expect(nextButtons(makeOrder(), 'rejected')).toEqual([])
  })

  it('after accepting, sends the order laid out for the kitchen with the prepare button', () => {
    const [message] = afterChangeMessages(makeOrder({ status: 'accepted' }), 'accepted')
    expect(message.kind).toBe('buttons')
    if (message.kind !== 'buttons') return
    expect(message.body).toContain(
      '2× Americano grande (Leche de almendra, Extra shot)\n   Nota: sin azúcar',
    )
    expect(message.body).toContain('Cómo llegar: Entrando por la calle\nde la iglesia')
    expect(message.buttons).toEqual([
      { id: `order:${ORDER_ID}:preparing`, title: 'Lo estoy preparando' },
    ])
  })

  it('splits a kitchen detail too long for an interactive body', () => {
    const order = makeOrder({
      items: Array.from({ length: 30 }, () => ({
        name: 'Platillo con nombre largo',
        variant_name: null,
        options: [],
        quantity: 1,
        note: 'una nota cualquiera',
      })),
    })
    const messages = afterChangeMessages(order, 'accepted')
    expect(messages.map((m) => m.kind)).toEqual(['text', 'buttons'])
    if (messages[1].kind === 'buttons') expect(messages[1].body.length).toBeLessThanOrEqual(1024)
  })

  it('closes without buttons on the way and on reject', () => {
    expect(afterChangeMessages(makeOrder(), 'on_the_way')).toEqual([
      { kind: 'text', body: 'Listo. Ana López confirma en la app cuando lo reciba.' },
    ])
    expect(afterChangeMessages(makeOrder(), 'rejected')).toEqual([
      {
        kind: 'text',
        body: 'Rechazaste el pedido de Ana López. Si fue un error, llámale: +52 618 123 4567',
      },
    ])
  })

  it('answers a repeated tap with where the order is and the next button', () => {
    const message = unchangedMessage(makeOrder(), 'accepted', 'accepted')
    expect(message).toEqual({
      kind: 'buttons',
      body: 'El pedido de Ana López ya está aceptado.',
      buttons: [{ id: `order:${ORDER_ID}:preparing`, title: 'Lo estoy preparando' }],
    })
    expect(unchangedMessage(makeOrder({ mode: 'pickup' }), 'on_the_way', 'on_the_way')).toEqual({
      kind: 'text',
      body: 'El pedido de Ana López ya está listo para recoger.',
    })
  })

  it('tells the owner to call when she rejects an accepted order', () => {
    const message = unchangedMessage(makeOrder(), 'rejected', 'preparing')
    expect(message.kind).toBe('buttons')
    if (message.kind === 'buttons') {
      expect(message.body).toBe(
        'Ya aceptaste el pedido de Ana López. Si no se va a poder entregar, llámale al cliente: +52 618 123 4567',
      )
    }
  })
})
