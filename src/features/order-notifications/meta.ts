import 'server-only'
import { env } from '@/lib/env'
import { TEMPLATE_LANGUAGE } from './format'
import type { OutgoingMessage, SendResult } from './types'

const GRAPH_VERSION = 'v23.0'
const SEND_TIMEOUT_MS = 10_000

export type WhatsappConfig = {
  accessToken: string
  phoneNumberId: string
  appSecret: string
  verifyToken: string
  graphUrl: string
}

/**
 * The WhatsApp Cloud API settings, or null while they are not loaded in the
 * environment: the routes answer 503 instead of the whole panel failing to
 * build over a WhatsApp variable.
 */
export function whatsappConfig(): WhatsappConfig | null {
  const {
    WHATSAPP_ACCESS_TOKEN: accessToken,
    WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
    WHATSAPP_APP_SECRET: appSecret,
    WHATSAPP_VERIFY_TOKEN: verifyToken,
  } = env
  if (!accessToken || !phoneNumberId || !appSecret || !verifyToken) return null
  return {
    accessToken,
    phoneNumberId,
    appSecret,
    verifyToken,
    graphUrl: env.WHATSAPP_GRAPH_URL ?? 'https://graph.facebook.com',
  }
}

function toPayload(to: string, message: OutgoingMessage): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to }
  switch (message.kind) {
    case 'text':
      return { ...base, type: 'text', text: { body: message.body, preview_url: false } }
    case 'buttons':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message.body },
          action: {
            buttons: message.buttons.map((b) => ({ type: 'reply', reply: b })),
          },
        },
      }
    case 'template': {
      const named = (params: Record<string, string>) =>
        Object.entries(params).map(([name, text]) => ({
          type: 'text',
          parameter_name: name,
          text,
        }))
      return {
        ...base,
        type: 'template',
        biz_opaque_callback_data: message.callbackData,
        template: {
          name: message.name,
          language: { code: TEMPLATE_LANGUAGE },
          components: [
            { type: 'header', parameters: named(message.headerParams) },
            { type: 'body', parameters: named(message.bodyParams) },
            ...message.buttonPayloads.map((payload, index) => ({
              type: 'button',
              sub_type: 'quick_reply',
              index: String(index),
              parameters: [{ type: 'payload', payload }],
            })),
          ],
        },
      }
    }
  }
}

/** Sends one message from Vichente's number. Never throws: errors come back as text. */
export async function sendWhatsapp(
  config: WhatsappConfig,
  to: string,
  message: OutgoingMessage,
): Promise<SendResult> {
  try {
    const response = await fetch(
      `${config.graphUrl}/${GRAPH_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toPayload(to, message)),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        cache: 'no-store',
      },
    )
    const body = (await response.json().catch(() => null)) as {
      messages?: { id?: string }[]
      error?: { code?: number; message?: string; error_data?: { details?: string } }
    } | null

    const messageId = body?.messages?.[0]?.id
    if (response.ok && messageId) return { ok: true, messageId }

    const error = body?.error
    const text = [error?.code ?? response.status, error?.message, error?.error_data?.details]
      .filter(Boolean)
      .join(': ')
    return { ok: false, error: text.slice(0, 500) }
  } catch (error) {
    return { ok: false, error: `Sin respuesta de Meta: ${String(error)}`.slice(0, 500) }
  }
}
