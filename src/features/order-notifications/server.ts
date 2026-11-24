import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeMxPhone } from '@/lib/validation/phone'
import { sendWhatsapp, whatsappConfig, type WhatsappConfig } from './meta'
import { notifyRestaurant, type NotifyDeps } from './notify'
import { sameSecret, verifyMetaSignature } from './signature'
import type { NotifyStatus, OrderForMessage, OrderItem, OrderMode, OrderStatus } from './types'
import { parseWebhook, processWebhookEvents, type WebhookDeps, type WebhookEvent } from './webhook'

// Orders are read and written with service_role: the restaurant has no
// session, and anon has no grants on `orders`. set_order_status and the
// orders_guard trigger keep the server from skipping steps or touching what
// was ordered.

// One literal, so supabase-js infers the row type from database.types.ts.
const ORDER_COLUMNS =
  'id, status, mode, items, subtotal_cents, delivery_fee_cents, total_cents, customer_name, customer_phone, delivery_lat, delivery_lng, delivery_directions, delivery_references, pays_with, businesses(phone, phone_is_whatsapp, whatsapp_phone)'

type BusinessContact = {
  phone: string
  phone_is_whatsapp: boolean
  whatsapp_phone: string | null
} | null

/** Same rule as create_order: whatsapp_phone, or phone when it is WhatsApp. */
function businessWhatsapp(b: BusinessContact): string | null {
  if (!b) return null
  const raw = b.whatsapp_phone?.trim() || (b.phone_is_whatsapp ? b.phone?.trim() : '') || ''
  const digits = normalizeMxPhone(raw)
  return digits.length === 10 ? digits : null
}

function toItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return []
  return items.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>
    const options = Array.isArray(item.options) ? item.options : []
    return {
      name: String(item.name ?? ''),
      variant_name: typeof item.variant_name === 'string' ? item.variant_name : null,
      options: options.map((o) => {
        const option = (o ?? {}) as Record<string, unknown>
        return { group_name: String(option.group_name ?? ''), name: String(option.name ?? '') }
      }),
      quantity: Number(item.quantity ?? 1),
      note: typeof item.note === 'string' && item.note.trim() ? item.note : null,
    }
  })
}

async function loadOrder(orderId: string): Promise<OrderForMessage | null> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`)
  if (!data) return null
  const row = data
  return {
    id: row.id,
    status: row.status as OrderStatus,
    mode: row.mode as OrderMode,
    items: toItems(row.items),
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryLat: row.delivery_lat,
    deliveryLng: row.delivery_lng,
    deliveryDirections: row.delivery_directions,
    deliveryReferences: row.delivery_references,
    paysWith: row.pays_with,
    businessWhatsapp: businessWhatsapp(row.businesses),
  }
}

/** Moves the notice of an order still in `from` to `to`; true if it moved. */
async function moveNotice(
  orderId: string,
  from: NotifyStatus | NotifyStatus[],
  to: NotifyStatus,
  error: string | null = null,
): Promise<boolean> {
  const { data, error: dbError } = await createAdminClient()
    .from('orders')
    .update({ notify_status: to, notify_error: error })
    .eq('id', orderId)
    .in('notify_status', Array.isArray(from) ? from : [from])
    .select('id')
  if (dbError) throw new Error(`No se pudo anotar el aviso: ${dbError.message}`)
  return (data?.length ?? 0) > 0
}

const log = (message: string, detail?: unknown) =>
  console.error(`[order-notifications] ${message}`, detail ?? '')

function notifyDeps(config: WhatsappConfig): NotifyDeps {
  return {
    async claim(token) {
      const db = createAdminClient()
      const { data: claimed, error } = await db
        .from('orders')
        .update({ notify_status: 'sending' })
        .eq('token', token)
        .eq('notify_status', 'pending')
        .select('id')
        .maybeSingle()
      if (error) throw new Error(`No se pudo tomar el aviso: ${error.message}`)
      if (claimed) return { claimed: true, orderId: claimed.id }

      const { data: current, error: readError } = await db
        .from('orders')
        .select('id, notify_status, notify_updated_at')
        .eq('token', token)
        .maybeSingle()
      if (readError) throw new Error(`No se pudo leer el aviso: ${readError.message}`)
      if (!current) return null
      return {
        claimed: false,
        orderId: current.id,
        notifyStatus: current.notify_status as NotifyStatus,
        notifyUpdatedAt: current.notify_updated_at,
      }
    },
    loadOrder,
    async markSent(orderId) {
      await moveNotice(orderId, 'sending', 'sent')
    },
    async markFailed(orderId, error) {
      await moveNotice(orderId, 'sending', 'failed', error.slice(0, 500))
    },
    async markStuckFailed(orderId, notifyUpdatedAt) {
      const db = createAdminClient()
      let update = db
        .from('orders')
        .update({ notify_status: 'failed', notify_error: 'El envío se interrumpió' })
        .eq('id', orderId)
        .eq('notify_status', 'sending')
      update = notifyUpdatedAt
        ? update.eq('notify_updated_at', notifyUpdatedAt)
        : update.is('notify_updated_at', null)
      const { error } = await update
      if (error) throw new Error(`No se pudo anotar el aviso: ${error.message}`)
      const { data } = await db.from('orders').select('notify_status').eq('id', orderId).single()
      return (data?.notify_status ?? 'failed') as NotifyStatus
    },
    send: (to, message) => sendWhatsapp(config, to, message),
    now: () => Date.now(),
    log,
  }
}

function webhookDeps(config: WhatsappConfig): WebhookDeps {
  return {
    loadOrder,
    async setStatus(orderId, action) {
      const { data, error } = await createAdminClient().rpc('set_order_status', {
        p_order_id: orderId,
        p_status: action,
      })
      if (error || !data?.[0]) throw new Error(`set_order_status: ${error?.message ?? 'sin filas'}`)
      return { status: data[0].status as OrderStatus, changed: data[0].changed }
    },
    send: (to, message) => sendWhatsapp(config, to, message),
    async markDeliveryFailed(orderId, error) {
      // A notice Meta took, even if the failure arrives before the server
      // wrote `sent`: then markSent finds it failed and leaves it alone.
      await moveNotice(orderId, ['sending', 'sent'], 'failed', error.slice(0, 500))
    },
    log,
  }
}

export type NotifyResponse =
  | { status: 200; body: { notify_status: NotifyStatus } }
  | { status: 404 | 503; body: { error: string } }

export async function notifyOrderByToken(token: string): Promise<NotifyResponse> {
  const config = whatsappConfig()
  if (!config) return { status: 503, body: { error: 'whatsapp_not_configured' } }
  const result = await notifyRestaurant(token, notifyDeps(config))
  if (!result) return { status: 404, body: { error: 'order_not_found' } }
  return { status: 200, body: { notify_status: result.notifyStatus } }
}

/** Meta's subscription check: echo the challenge only with our verify token. */
export function verifySubscription(params: URLSearchParams): { status: number; body: string } {
  const config = whatsappConfig()
  if (!config) return { status: 503, body: 'whatsapp_not_configured' }
  if (
    params.get('hub.mode') === 'subscribe' &&
    sameSecret(params.get('hub.verify_token'), config.verifyToken)
  ) {
    return { status: 200, body: params.get('hub.challenge') ?? '' }
  }
  return { status: 403, body: 'forbidden' }
}

export type WebhookReceipt =
  | { status: 200; events: WebhookEvent[]; process: () => Promise<void> }
  | { status: 400 | 401 | 503; events?: undefined; process?: undefined }

/**
 * Checks the signature and reads the events. The route answers Meta right
 * away and runs `process` after the response, so Meta does not retry while
 * the replies are being sent.
 */
export function receiveWebhook(rawBody: string, signature: string | null): WebhookReceipt {
  const config = whatsappConfig()
  if (!config) return { status: 503 }
  if (!verifyMetaSignature(rawBody, signature, config.appSecret)) return { status: 401 }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { status: 400 }
  }
  const events = parseWebhook(body, config.phoneNumberId)
  return {
    status: 200,
    events,
    process: () => processWebhookEvents(events, webhookDeps(config)),
  }
}
