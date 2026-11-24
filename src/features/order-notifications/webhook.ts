/**
 * What to do with a WhatsApp webhook call, already signature-checked. Pure
 * logic over injected dependencies, so the tests can drive it without Meta or
 * the database; `server.ts` wires the real ones.
 */
import {
  UNATTENDED_REPLY,
  afterChangeMessages,
  parseButtonPayload,
  parseCallbackData,
  unchangedMessage,
} from './format'
import type {
  OrderAction,
  OrderForMessage,
  OrderStatus,
  OutgoingMessage,
  SendResult,
} from './types'

export type WebhookEvent =
  | { kind: 'tap'; from: string; orderId: string; action: OrderAction }
  | { kind: 'message'; from: string }
  | { kind: 'delivery_failed'; orderId: string; error: string }

export type WebhookDeps = {
  loadOrder(orderId: string): Promise<OrderForMessage | null>
  setStatus(
    orderId: string,
    action: OrderAction,
  ): Promise<{ status: OrderStatus; changed: boolean }>
  /** `to` is the WhatsApp id: country code and number, digits only. */
  send(to: string, message: OutgoingMessage): Promise<SendResult>
  markDeliveryFailed(orderId: string, error: string): Promise<void>
  log(message: string, detail?: unknown): void
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

// Messages that are not someone writing to the number: no reply.
const SILENT_TYPES = new Set(['reaction', 'system', 'ephemeral', 'unsupported', 'request_welcome'])

/**
 * Pulls the events this flow cares about out of a webhook body. Only the
 * changes of `phoneNumberId` count: the same Meta app can have other numbers
 * (the test one), and their messages are not ours to answer.
 */
export function parseWebhook(body: unknown, phoneNumberId: string): WebhookEvent[] {
  const events: WebhookEvent[] = []
  if (obj(body).object !== 'whatsapp_business_account') return events

  for (const entry of arr(obj(body).entry)) {
    for (const change of arr(obj(entry).changes)) {
      if (obj(change).field !== 'messages') continue
      const value = obj(obj(change).value)
      if (str(obj(value.metadata).phone_number_id) !== phoneNumberId) continue

      for (const raw of arr(value.messages)) {
        const message = obj(raw)
        const from = str(message.from)
        const type = str(message.type)
        if (!from || !type || SILENT_TYPES.has(type)) continue

        let payload: string | null = null
        if (type === 'button') payload = str(obj(message.button).payload)
        if (type === 'interactive') {
          const interactive = obj(message.interactive)
          if (interactive.type === 'button_reply') payload = str(obj(interactive.button_reply).id)
        }

        const tap = parseButtonPayload(payload)
        events.push(tap ? { kind: 'tap', from, ...tap } : { kind: 'message', from })
      }

      for (const raw of arr(value.statuses)) {
        const status = obj(raw)
        if (status.status !== 'failed') continue
        // Only the new-order template carries the callback data.
        const orderId = parseCallbackData(str(status.biz_opaque_callback_data))
        if (!orderId) continue
        const error = obj(arr(status.errors)[0])
        const details = str(obj(error.error_data).details)
        events.push({
          kind: 'delivery_failed',
          orderId,
          error: [error.code, str(error.title) ?? str(error.message), details]
            .filter(Boolean)
            .join(': '),
        })
      }
    }
  }
  return events
}

export async function processWebhookEvents(events: WebhookEvent[], deps: WebhookDeps) {
  for (const event of events) {
    try {
      if (event.kind === 'tap') await handleTap(event, deps)
      else if (event.kind === 'message')
        await reply(deps, event.from, [{ kind: 'text', body: UNATTENDED_REPLY }])
      else await deps.markDeliveryFailed(event.orderId, event.error || 'Meta no entregó el mensaje')
    } catch (error) {
      deps.log('whatsapp webhook event failed', { event, error: String(error) })
    }
  }
}

async function handleTap(event: Extract<WebhookEvent, { kind: 'tap' }>, deps: WebhookDeps) {
  const order = await deps.loadOrder(event.orderId)
  if (!order) {
    deps.log('whatsapp tap for an unknown order', { orderId: event.orderId })
    return
  }

  // Only the business's own WhatsApp moves its orders: a forwarded message
  // must not hand the order to whoever received it.
  if (!isBusinessNumber(event.from, order.businessWhatsapp)) {
    deps.log('whatsapp tap from a number that is not the business', { orderId: order.id })
    return
  }

  const result = await deps.setStatus(order.id, event.action)
  const current = { ...order, status: result.status }
  const messages = result.changed
    ? afterChangeMessages(current, result.status)
    : [unchangedMessage(current, event.action, result.status)]
  await reply(deps, event.from, messages)
}

/**
 * Meta writes a Mexican number as 52 or 521 plus the 10 digits. Compared
 * exactly: trimming a longer number to 10 digits would let a foreign number
 * that happens to start with those digits pass.
 */
export function isBusinessNumber(from: string, businessWhatsapp: string | null): boolean {
  if (!businessWhatsapp) return false
  return from === `52${businessWhatsapp}` || from === `521${businessWhatsapp}`
}

async function reply(deps: WebhookDeps, to: string, messages: OutgoingMessage[]) {
  for (const message of messages) {
    const sent = await deps.send(to, message)
    if (!sent.ok) {
      deps.log('whatsapp reply failed', { error: sent.error })
      return
    }
  }
}
