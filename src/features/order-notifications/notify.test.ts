import { describe, expect, it, vi } from 'vitest'
import { STUCK_SENDING_MS, notifyRestaurant, type NotifyDeps } from './notify'
import { ORDER_ID, makeOrder } from './test-fixtures'
import type { NotifyStatus, SendResult } from './types'

const TOKEN = 'token-del-cliente-abc123'
const NOW = Date.parse('2026-11-24T18:00:00Z')

/** A fake order row with the real pending → sending claim. */
function fakeDeps(
  opts: { send?: SendResult; status?: NotifyStatus; updatedAt?: string | null } = {},
) {
  const row = {
    notifyStatus: opts.status ?? ('pending' as NotifyStatus),
    notifyUpdatedAt: opts.updatedAt ?? null,
    error: null as string | null,
  }
  const deps: NotifyDeps = {
    claim: vi.fn(async (token: string) => {
      if (token !== TOKEN) return null
      if (row.notifyStatus === 'pending') {
        row.notifyStatus = 'sending'
        return { claimed: true as const, orderId: ORDER_ID }
      }
      return {
        claimed: false as const,
        orderId: ORDER_ID,
        notifyStatus: row.notifyStatus,
        notifyUpdatedAt: row.notifyUpdatedAt,
      }
    }),
    loadOrder: vi.fn(async () => makeOrder()),
    markSent: vi.fn(async () => {
      row.notifyStatus = 'sent'
    }),
    markFailed: vi.fn(async (_id: string, error: string) => {
      row.notifyStatus = 'failed'
      row.error = error
    }),
    markStuckFailed: vi.fn(async () => {
      row.notifyStatus = 'failed'
      return row.notifyStatus
    }),
    send: vi.fn(async () => opts.send ?? { ok: true as const, messageId: 'wamid.x' }),
    now: () => NOW,
    log: vi.fn(),
  }
  return { row, deps }
}

describe('notifyRestaurant', () => {
  it('sends the template to the business WhatsApp and marks it sent', async () => {
    const { row, deps } = fakeDeps()
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'sent' })
    expect(row.notifyStatus).toBe('sent')
    expect(deps.send).toHaveBeenCalledWith(
      '526189998877',
      expect.objectContaining({ kind: 'template', name: 'pedido_domicilio' }),
    )
  })

  it('a second call does not send a second message', async () => {
    const { deps } = fakeDeps()
    await notifyRestaurant(TOKEN, deps)
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'sent' })
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  it('records the error when Meta rejects the message', async () => {
    const { row, deps } = fakeDeps({
      send: { ok: false, error: '132001: Template name does not exist in the translation' },
    })
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'failed' })
    expect(row).toMatchObject({
      notifyStatus: 'failed',
      error: '132001: Template name does not exist in the translation',
    })
    // And it is not retried on the next call.
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'failed' })
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  it('fails without sending when the business has no WhatsApp', async () => {
    const { row, deps } = fakeDeps()
    vi.mocked(deps.loadOrder).mockResolvedValueOnce(makeOrder({ businessWhatsapp: null }))
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'failed' })
    expect(deps.send).not.toHaveBeenCalled()
    expect(row.error).toBe('El negocio no tiene WhatsApp')
  })

  it('records an unexpected error instead of leaving the notice in sending', async () => {
    const { row, deps } = fakeDeps()
    vi.mocked(deps.loadOrder).mockRejectedValueOnce(new Error('db down'))
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'failed' })
    expect(row.error).toBe('db down')
  })

  it('an unknown token is not found', async () => {
    const { deps } = fakeDeps()
    expect(await notifyRestaurant('otro-token-cualquiera', deps)).toBeNull()
  })

  it('leaves a notice being sent right now alone', async () => {
    const { deps } = fakeDeps({
      status: 'sending',
      updatedAt: new Date(NOW - 10_000).toISOString(),
    })
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'sending' })
    expect(deps.markStuckFailed).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('marks failed a notice stuck in sending, without sending again', async () => {
    const updatedAt = new Date(NOW - STUCK_SENDING_MS - 1000).toISOString()
    const { deps } = fakeDeps({ status: 'sending', updatedAt })
    expect(await notifyRestaurant(TOKEN, deps)).toEqual({ notifyStatus: 'failed' })
    expect(deps.markStuckFailed).toHaveBeenCalledWith(ORDER_ID, updatedAt)
    expect(deps.send).not.toHaveBeenCalled()
  })
})
