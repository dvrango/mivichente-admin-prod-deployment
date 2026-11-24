import type { OrderForMessage } from './types'

export const ORDER_ID = '11111111-2222-4333-8444-555555555555'

export function makeOrder(overrides: Partial<OrderForMessage> = {}): OrderForMessage {
  return {
    id: ORDER_ID,
    status: 'pending',
    mode: 'delivery',
    items: [
      {
        name: 'Americano',
        variant_name: 'grande',
        options: [
          { group_name: 'Leche', name: 'Leche de almendra' },
          { group_name: 'Extras', name: 'Extra shot' },
        ],
        quantity: 2,
        note: 'sin azúcar',
      },
      { name: 'Pan de elote', variant_name: null, options: [], quantity: 1, note: null },
    ],
    subtotalCents: 13200,
    deliveryFeeCents: 2000,
    totalCents: 15200,
    customerName: 'Ana López',
    customerPhone: '6181234567',
    deliveryLat: 23.73,
    deliveryLng: -103.98,
    deliveryDirections: 'Entrando por la calle\nde la iglesia',
    deliveryReferences: 'Casa azul,\tportón negro',
    paysWith: '200',
    businessWhatsapp: '6189998877',
    ...overrides,
  }
}
