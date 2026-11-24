/**
 * Sends the restaurant the new-order template. The app calls it right after
 * create_order, and again when it reopens an order whose notice is still
 * pending, so a second call must not send a second message: the order is
 * taken with a single pending → sending update and only that caller sends.
 */
import { newOrderTemplate } from './format'
import type { NotifyStatus, OrderForMessage, OutgoingMessage, SendResult } from './types'

/** A notice stuck in `sending` this long means the server died halfway. */
export const STUCK_SENDING_MS = 2 * 60 * 1000

export type ClaimResult =
  | { claimed: true; orderId: string }
  | { claimed: false; orderId: string; notifyStatus: NotifyStatus; notifyUpdatedAt: string | null }

export type NotifyDeps = {
  /** pending → sending for this token; null when the token does not exist. */
  claim(token: string): Promise<ClaimResult | null>
  loadOrder(orderId: string): Promise<OrderForMessage | null>
  markSent(orderId: string): Promise<void>
  markFailed(orderId: string, error: string): Promise<void>
  /** sending → failed, only if it is still the same stuck attempt. */
  markStuckFailed(orderId: string, notifyUpdatedAt: string | null): Promise<NotifyStatus>
  send(to: string, message: OutgoingMessage): Promise<SendResult>
  now(): number
  log(message: string, detail?: unknown): void
}

export async function notifyRestaurant(
  token: string,
  deps: NotifyDeps,
): Promise<{ notifyStatus: NotifyStatus } | null> {
  const claim = await deps.claim(token)
  if (!claim) return null

  if (!claim.claimed) {
    const startedAt = claim.notifyUpdatedAt ? Date.parse(claim.notifyUpdatedAt) : 0
    if (claim.notifyStatus === 'sending' && deps.now() - startedAt > STUCK_SENDING_MS) {
      // Not retried: Meta may have delivered it before the server died, and
      // a failed notice tells the customer to call, which is safe either way.
      return { notifyStatus: await deps.markStuckFailed(claim.orderId, claim.notifyUpdatedAt) }
    }
    return { notifyStatus: claim.notifyStatus }
  }

  const fail = async (error: string) => {
    deps.log('order notice failed', { orderId: claim.orderId, error })
    await deps.markFailed(claim.orderId, error)
    return { notifyStatus: 'failed' as const }
  }

  try {
    const order = await deps.loadOrder(claim.orderId)
    if (!order) return await fail('No se encontró el pedido')
    if (!order.businessWhatsapp) return await fail('El negocio no tiene WhatsApp')

    const result = await deps.send(`52${order.businessWhatsapp}`, newOrderTemplate(order))
    if (!result.ok) return await fail(result.error)

    await deps.markSent(claim.orderId)
    return { notifyStatus: 'sent' }
  } catch (error) {
    return await fail(error instanceof Error ? error.message : String(error))
  }
}
