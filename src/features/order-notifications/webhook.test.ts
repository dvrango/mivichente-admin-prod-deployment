import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { UNATTENDED_REPLY, buttonPayload } from './format'
import { sameSecret, verifyMetaSignature } from './signature'
import { ORDER_ID, makeOrder } from './test-fixtures'
import type { OrderAction, OrderForMessage, OrderStatus, OutgoingMessage } from './types'
import { parseWebhook, processWebhookEvents, type WebhookDeps } from './webhook'

const PHONE_NUMBER_ID = '1400299946509506'
const OWNER = '5216189998877' // how Meta writes a Mexican number in `from`
const SECRET = 'app-secret-de-prueba'

function body(value: Record<string, unknown>, phoneNumberId = PHONE_NUMBER_ID) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '526182163649', phone_number_id: phoneNumberId },
              ...value,
            },
          },
        ],
      },
    ],
  }
}

const templateTap = (action: OrderAction, from = OWNER) =>
  body({
    messages: [
      {
        from,
        id: 'wamid.1',
        type: 'button',
        button: { payload: buttonPayload(ORDER_ID, action), text: 'Aceptar' },
      },
    ],
  })

const interactiveTap = (action: OrderAction, from = OWNER) =>
  body({
    messages: [
      {
        from,
        id: 'wamid.2',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: buttonPayload(ORDER_ID, action), title: 'Ya salió' },
        },
      },
    ],
  })

/**
 * A fake database with the real transition rules (order_status_transition_ok):
 * a step that is not valid from the current status changes nothing.
 */
function fakeDeps(order: OrderForMessage = makeOrder()) {
  const allowed: [OrderStatus, OrderStatus][] = [
    ['pending', 'accepted'],
    ['pending', 'rejected'],
    ['accepted', 'preparing'],
    ['preparing', 'on_the_way'],
  ]
  const state = { order: { ...order }, sent: [] as { to: string; message: OutgoingMessage }[] }
  const deps: WebhookDeps = {
    loadOrder: vi.fn(async (id: string) => (id === state.order.id ? { ...state.order } : null)),
    setStatus: vi.fn(async (_id: string, action: OrderAction) => {
      const ok = allowed.some(([from, to]) => from === state.order.status && to === action)
      if (ok) state.order.status = action
      return { status: state.order.status, changed: ok }
    }),
    send: vi.fn(async (to: string, message: OutgoingMessage) => {
      state.sent.push({ to, message })
      return { ok: true as const, messageId: `wamid.out.${state.sent.length}` }
    }),
    markDeliveryFailed: vi.fn(async () => {}),
    log: vi.fn(),
  }
  return { state, deps }
}

async function run(payload: unknown, deps: WebhookDeps) {
  await processWebhookEvents(parseWebhook(payload, PHONE_NUMBER_ID), deps)
}

describe('signature', () => {
  const raw = JSON.stringify(templateTap('accepted'))
  const sign = (text: string, secret = SECRET) =>
    `sha256=${createHmac('sha256', secret).update(text).digest('hex')}`

  it('accepts the body Meta signed with the app secret', () => {
    expect(verifyMetaSignature(raw, sign(raw), SECRET)).toBe(true)
  })

  it('rejects a missing, malformed, foreign or tampered signature', () => {
    expect(verifyMetaSignature(raw, null, SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, 'sha256=', SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, 'sha1=abc', SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, sign(raw, 'otro-secreto'), SECRET)).toBe(false)
    expect(verifyMetaSignature(raw.replace('accepted', 'rejected'), sign(raw), SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, sign(raw), '')).toBe(false)
  })

  it('compares the verify token exactly', () => {
    expect(sameSecret('token-de-verificacion', 'token-de-verificacion')).toBe(true)
    expect(sameSecret('token-de-verificacio', 'token-de-verificacion')).toBe(false)
    expect(sameSecret(null, 'token-de-verificacion')).toBe(false)
  })
})

describe('parseWebhook', () => {
  it('reads taps from the template and from interactive messages', () => {
    expect(parseWebhook(templateTap('accepted'), PHONE_NUMBER_ID)).toEqual([
      { kind: 'tap', from: OWNER, orderId: ORDER_ID, action: 'accepted' },
    ])
    expect(parseWebhook(interactiveTap('on_the_way'), PHONE_NUMBER_ID)).toEqual([
      { kind: 'tap', from: OWNER, orderId: ORDER_ID, action: 'on_the_way' },
    ])
  })

  it('ignores another number of the same Meta app and other objects', () => {
    expect(parseWebhook(body({ messages: [] }, '999'), PHONE_NUMBER_ID)).toEqual([])
    expect(parseWebhook(templateTap('accepted'), '999')).toEqual([])
    expect(parseWebhook({ object: 'page' }, PHONE_NUMBER_ID)).toEqual([])
    expect(parseWebhook(null, PHONE_NUMBER_ID)).toEqual([])
  })

  it('treats text and audio as a message, and stays quiet on reactions', () => {
    const events = parseWebhook(
      body({
        messages: [
          { from: OWNER, id: 'a', type: 'text', text: { body: 'hola' } },
          { from: OWNER, id: 'b', type: 'audio', audio: { id: 'x' } },
          { from: OWNER, id: 'c', type: 'reaction', reaction: { emoji: '👍' } },
        ],
      }),
      PHONE_NUMBER_ID,
    )
    expect(events).toEqual([
      { kind: 'message', from: OWNER },
      { kind: 'message', from: OWNER },
    ])
  })

  it('reads a failed delivery of the template, and only that one', () => {
    const events = parseWebhook(
      body({
        statuses: [
          { id: 'w1', status: 'delivered', biz_opaque_callback_data: `order:${ORDER_ID}` },
          {
            id: 'w2',
            status: 'failed',
            biz_opaque_callback_data: `order:${ORDER_ID}`,
            errors: [{ code: 131026, title: 'Message undeliverable' }],
          },
          { id: 'w3', status: 'failed', errors: [{ code: 1 }] },
        ],
      }),
      PHONE_NUMBER_ID,
    )
    expect(events).toEqual([
      { kind: 'delivery_failed', orderId: ORDER_ID, error: '131026: Message undeliverable' },
    ])
  })
})

describe('processWebhookEvents', () => {
  it('walks the whole delivery flow and answers each step', async () => {
    const { state, deps } = fakeDeps()

    await run(templateTap('accepted'), deps)
    expect(state.order.status).toBe('accepted')
    expect(state.sent.at(-1)).toMatchObject({
      to: OWNER,
      message: { kind: 'buttons', buttons: [{ title: 'Lo estoy preparando' }] },
    })

    await run(interactiveTap('preparing'), deps)
    expect(state.order.status).toBe('preparing')
    expect(state.sent.at(-1)?.message).toMatchObject({ buttons: [{ title: 'Ya salió' }] })

    await run(interactiveTap('on_the_way'), deps)
    expect(state.order.status).toBe('on_the_way')
    expect(state.sent.at(-1)?.message).toEqual({
      kind: 'text',
      body: 'Listo. Ana López confirma en la app cuando lo reciba.',
    })
  })

  it('rejecting closes the order', async () => {
    const { state, deps } = fakeDeps()
    await run(templateTap('rejected'), deps)
    expect(state.order.status).toBe('rejected')
    await run(templateTap('accepted'), deps)
    expect(state.order.status).toBe('rejected')
    expect(state.sent.at(-1)?.message).toEqual({
      kind: 'text',
      body: 'El pedido de Ana López ya está rechazado.',
    })
  })

  it('a repeated tap, or one from an old message, never moves the order back or ahead', async () => {
    const { state, deps } = fakeDeps(makeOrder({ status: 'preparing' }))

    await run(templateTap('accepted'), deps) // old template, tapped again
    expect(state.order.status).toBe('preparing')
    expect(state.sent.at(-1)?.message).toMatchObject({
      body: 'El pedido de Ana López ya está en preparación.',
      buttons: [{ title: 'Ya salió' }],
    })

    await run(templateTap('rejected'), deps)
    expect(state.order.status).toBe('preparing')
    expect(state.sent.at(-1)?.message).toMatchObject({
      body: expect.stringContaining('Ya aceptaste el pedido'),
    })

    await run(interactiveTap('on_the_way'), deps)
    await run(interactiveTap('on_the_way'), deps) // Meta retried the webhook
    expect(state.order.status).toBe('on_the_way')
    await run(interactiveTap('preparing'), deps)
    expect(state.order.status).toBe('on_the_way')
  })

  it('a tap from a number that is not the business changes nothing and gets no answer', async () => {
    const { state, deps } = fakeDeps()
    await run(templateTap('accepted', '5216180000000'), deps)
    expect(deps.setStatus).not.toHaveBeenCalled()
    expect(state.sent).toEqual([])
    expect(state.order.status).toBe('pending')
  })

  it('a foreign number that starts with the business digits does not pass', async () => {
    const { deps } = fakeDeps()
    await run(templateTap('accepted', '61899988770'), deps) // +61 8 9998 8770
    await run(templateTap('accepted', '6189998877'), deps)
    await run(templateTap('accepted', '15216189998877'), deps)
    expect(deps.setStatus).not.toHaveBeenCalled()
  })

  it('a business without WhatsApp cannot move its orders', async () => {
    const { deps } = fakeDeps(makeOrder({ businessWhatsapp: null }))
    await run(templateTap('accepted'), deps)
    expect(deps.setStatus).not.toHaveBeenCalled()
  })

  it('accepts the owner number written with 52 or 521', async () => {
    const { state, deps } = fakeDeps()
    await run(templateTap('accepted', '526189998877'), deps)
    expect(state.order.status).toBe('accepted')
  })

  it('an unknown order changes nothing', async () => {
    const { deps } = fakeDeps(makeOrder({ id: '99999999-2222-4333-8444-555555555555' }))
    await run(templateTap('accepted'), deps)
    expect(deps.setStatus).not.toHaveBeenCalled()
  })

  it('answers text with the unattended reply', async () => {
    const { state, deps } = fakeDeps()
    await run(
      body({ messages: [{ from: OWNER, id: 'a', type: 'text', text: { body: 'hola' } }] }),
      deps,
    )
    expect(state.sent).toEqual([{ to: OWNER, message: { kind: 'text', body: UNATTENDED_REPLY } }])
    expect(deps.setStatus).not.toHaveBeenCalled()
  })

  it('records a failed delivery of the template', async () => {
    const { deps } = fakeDeps()
    await run(
      body({
        statuses: [
          {
            id: 'w2',
            status: 'failed',
            biz_opaque_callback_data: `order:${ORDER_ID}`,
            errors: [{ code: 131026, title: 'Message undeliverable' }],
          },
        ],
      }),
      deps,
    )
    expect(deps.markDeliveryFailed).toHaveBeenCalledWith(ORDER_ID, '131026: Message undeliverable')
  })

  it('one failing event does not stop the next ones', async () => {
    const { state, deps } = fakeDeps()
    vi.mocked(deps.loadOrder).mockRejectedValueOnce(new Error('db down'))
    await run(
      body({
        messages: [
          {
            from: OWNER,
            id: 'a',
            type: 'button',
            button: { payload: buttonPayload(ORDER_ID, 'accepted') },
          },
          { from: OWNER, id: 'b', type: 'text', text: { body: 'hola' } },
        ],
      }),
      deps,
    )
    expect(deps.log).toHaveBeenCalled()
    expect(state.sent.at(-1)?.message).toEqual({ kind: 'text', body: UNATTENDED_REPLY })
  })
})
