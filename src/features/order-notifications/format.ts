/**
 * Texts Vichente sends the restaurant on WhatsApp. The wording was approved
 * by the user (njr8m6mp2 § Lo que ve la dueña); the template names and
 * variables are the ones created in Meta (rr2jnzi0h).
 *
 * Limits that make Meta reject a message without a useful error:
 * - A template parameter cannot carry new lines, tabs or more than 4
 *   consecutive spaces (error 132018), and cannot be empty.
 * - A template header is at most 60 characters, a template body 1024.
 * - An interactive body is at most 1024 characters and a reply button
 *   title at most 20.
 * - A text message is at most 4096 characters.
 */
import { normalizeMxPhone } from '@/lib/validation/phone'
import {
  ORDER_ACTIONS,
  type OrderAction,
  type OrderForMessage,
  type OrderItem,
  type OrderStatus,
  type OutgoingMessage,
  type ReplyButton,
} from './types'

export const TEMPLATE_DELIVERY = 'pedido_domicilio'
export const TEMPLATE_PICKUP = 'pedido_recoger'
export const TEMPLATE_LANGUAGE = 'es_MX'

const HEADER_MAX = 60
const TEMPLATE_BODY_MAX = 1024
const INTERACTIVE_BODY_MAX = 1024
const TEXT_MAX = 4096
const ITEMS_PARAM_MAX = 600
const WHERE_PARAM_MAX = 320

// Static text of the template bodies, to know how much room the parameters
// have. Kept in sync by hand with the templates in Meta.
const DELIVERY_BODY_STATIC =
  'Te pidieron por Vichente:\n\n\nTotal: \nDónde: \n\nPara hablar con el cliente: \n¿Lo aceptas?'
const PICKUP_BODY_STATIC =
  'Te pidieron por Vichente:\n\n\nTotal: \nEl cliente pasa a recogerlo.\n\nPara hablar con el cliente: \n¿Lo aceptas?'

// ---------------------------------------------------------------- payloads

/** Button payload: the order id is not a secret, the action is the step. */
export function buttonPayload(orderId: string, action: OrderAction): string {
  return `order:${orderId}:${action}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseButtonPayload(
  payload: string | null | undefined,
): { orderId: string; action: OrderAction } | null {
  const parts = (payload ?? '').split(':')
  if (parts.length !== 3 || parts[0] !== 'order' || !UUID.test(parts[1])) return null
  const action = parts[2] as OrderAction
  if (!ORDER_ACTIONS.includes(action)) return null
  return { orderId: parts[1].toLowerCase(), action }
}

export function callbackData(orderId: string): string {
  return `order:${orderId}`
}

export function parseCallbackData(value: string | null | undefined): string | null {
  const parts = (value ?? '').split(':')
  if (parts.length !== 2 || parts[0] !== 'order' || !UUID.test(parts[1])) return null
  return parts[1].toLowerCase()
}

// ------------------------------------------------------------------ pieces

/** One line, no tabs, no runs of spaces: what a template parameter accepts. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** 15200 → "$152", 15250 → "$152.50", 125000 → "$1,250". */
export function money(cents: number): string {
  const pesos = Math.floor(Math.abs(cents) / 100)
  const rest = Math.abs(cents) % 100
  const whole = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${cents < 0 ? '-' : ''}$${whole}${rest ? `.${rest.toString().padStart(2, '0')}` : ''}`
}

/** "6181234567" → "+52 618 123 4567", so WhatsApp lets the owner tap it. */
export function displayPhone(phone: string | null): string {
  const d = normalizeMxPhone(phone)
  if (d.length !== 10) return 'sin teléfono'
  return `+52 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

export function customerName(order: OrderForMessage): string {
  return oneLine(order.customerName ?? '') || 'el cliente'
}

/** "2× Americano grande (Leche de almendra, Extra shot) – Nota: sin azúcar" */
export function itemText(item: OrderItem): string {
  const name = [item.name, item.variant_name].filter(Boolean).join(' ')
  const options = item.options?.length ? ` (${item.options.map((o) => o.name).join(', ')})` : ''
  const note = item.note ? ` – Nota: ${item.note}` : ''
  return oneLine(`${item.quantity}× ${name}${options}${note}`)
}

/**
 * All the items in one line, separated by «·». Past `max` characters it stops
 * at a whole item and adds «y N más»: the full order arrives after accepting.
 */
export function itemsLine(items: OrderItem[], max = ITEMS_PARAM_MAX): string {
  const texts = items.map(itemText)
  const full = texts.join(' · ')
  if (full.length <= max) return full

  const parts: string[] = []
  for (let i = 0; i < texts.length; i++) {
    const rest = texts.length - i - 1
    const suffix = rest > 0 ? ` · y ${rest} más` : ''
    const candidate = [...parts, texts[i]].join(' · ')
    // Keep the item only if what is left still fits with its «y N más».
    if (candidate.length + suffix.length > max) break
    parts.push(texts[i])
  }
  if (parts.length === 0) {
    const suffix = texts.length > 1 ? ` · y ${texts.length - 1} más` : ''
    return `${clip(texts[0], max - suffix.length)}${suffix}`
  }
  const missing = texts.length - parts.length
  return `${parts.join(' · ')}${missing > 0 ? ` · y ${missing} más` : ''}`
}

/** «$152 + envío por confirmar», «$85 con $20 de envío», «$96 con envío gratis», «$96». */
export function totalText(order: OrderForMessage): string {
  let text: string
  if (order.mode === 'pickup') text = money(order.totalCents)
  else if (order.deliveryFeeCents === null)
    text = `${money(order.totalCents)} + envío por confirmar`
  else if (order.deliveryFeeCents === 0) text = `${money(order.totalCents)} con envío gratis`
  else text = `${money(order.totalCents)} con ${money(order.deliveryFeeCents)} de envío`

  const paysWith = oneLine(order.paysWith ?? '')
  if (paysWith) text += ` · paga con ${/^\d+(\.\d+)?$/.test(paysWith) ? `$${paysWith}` : paysWith}`
  return text
}

export function mapLink(order: OrderForMessage): string | null {
  if (order.deliveryLat === null || order.deliveryLng === null) return null
  return `https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`
}

/** Map link, how to get there and references, in one line with «·». */
export function whereLine(order: OrderForMessage, max = WHERE_PARAM_MAX): string {
  const parts = [
    mapLink(order),
    order.deliveryDirections ? oneLine(order.deliveryDirections) : null,
    order.deliveryReferences ? `Referencias: ${oneLine(order.deliveryReferences)}` : null,
  ].filter((p): p is string => Boolean(p))
  return clip(parts.join(' · '), max) || 'por confirmar con el cliente'
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'pendiente',
  accepted: 'aceptado',
  rejected: 'rechazado',
  preparing: 'en preparación',
  on_the_way: 'en camino',
  delivered: 'entregado',
  withdrawn: 'retirado por el cliente',
}

export function statusLabel(status: OrderStatus, mode: OrderForMessage['mode']): string {
  if (status === 'on_the_way' && mode === 'pickup') return 'listo para recoger'
  return STATUS_LABEL[status]
}

// ---------------------------------------------------------------- messages

/** The first message: an approved template with Aceptar and Rechazar. */
export function newOrderTemplate(order: OrderForMessage): OutgoingMessage {
  const delivery = order.mode === 'delivery'
  const headerStatic = delivery ? 'Pedido a domicilio · ' : 'Pedido para recoger · '
  const cliente = clip(customerName(order), HEADER_MAX - headerStatic.length)
  const total = totalText(order)
  const telefono = displayPhone(order.customerPhone)
  const donde = delivery ? whereLine(order) : null

  const used =
    (delivery ? DELIVERY_BODY_STATIC : PICKUP_BODY_STATIC).length +
    total.length +
    telefono.length +
    (donde?.length ?? 0)
  // A small margin: Meta counts the final body and we would rather cut a dish.
  const room = Math.min(ITEMS_PARAM_MAX, TEMPLATE_BODY_MAX - used - 16)
  const platillos = itemsLine(order.items, Math.max(room, 80))

  return {
    kind: 'template',
    name: delivery ? TEMPLATE_DELIVERY : TEMPLATE_PICKUP,
    headerParams: { cliente },
    bodyParams: delivery
      ? { platillos, total, donde: donde!, telefono }
      : { platillos, total, telefono },
    buttonPayloads: [buttonPayload(order.id, 'accepted'), buttonPayload(order.id, 'rejected')],
    callbackData: callbackData(order.id),
  }
}

/** The next step the restaurant can take from `status`, as reply buttons. */
export function nextButtons(order: OrderForMessage, status: OrderStatus): ReplyButton[] {
  switch (status) {
    case 'pending':
      return [
        { id: buttonPayload(order.id, 'accepted'), title: 'Aceptar' },
        { id: buttonPayload(order.id, 'rejected'), title: 'Rechazar' },
      ]
    case 'accepted':
      return [{ id: buttonPayload(order.id, 'preparing'), title: 'Lo estoy preparando' }]
    case 'preparing':
      return [
        {
          id: buttonPayload(order.id, 'on_the_way'),
          title: order.mode === 'pickup' ? 'Ya está listo' : 'Ya salió',
        },
      ]
    default:
      return []
  }
}

/** The order laid out for the kitchen: one dish per line. Sent after accepting. */
export function kitchenDetail(order: OrderForMessage): string {
  const lines = [
    `Pedido de ${customerName(order)} · ${order.mode === 'pickup' ? 'para recoger' : 'a domicilio'}`,
    '',
    ...order.items.flatMap((item) => {
      const name = [item.name, item.variant_name].filter(Boolean).join(' ')
      const options = item.options?.length ? ` (${item.options.map((o) => o.name).join(', ')})` : ''
      const line = oneLine(`${item.quantity}× ${name}${options}`)
      return item.note ? [line, `   Nota: ${item.note.trim()}`] : [line]
    }),
    '',
    `Total: ${totalText(order)}`,
  ]
  if (order.mode === 'delivery') {
    const link = mapLink(order)
    if (link) lines.push(`Ubicación: ${link}`)
    if (order.deliveryDirections) lines.push(`Cómo llegar: ${order.deliveryDirections.trim()}`)
    if (order.deliveryReferences) lines.push(`Referencias: ${order.deliveryReferences.trim()}`)
  } else {
    lines.push('El cliente pasa a recogerlo.')
  }
  lines.push(`Cliente: ${displayPhone(order.customerPhone)}`)
  return lines.join('\n')
}

function withButtons(body: string, buttons: ReplyButton[]): OutgoingMessage {
  return buttons.length
    ? { kind: 'buttons', body: clip(body, INTERACTIVE_BODY_MAX), buttons }
    : { kind: 'text', body: clip(body, TEXT_MAX) }
}

/** What to send after the step to `status` went through. */
export function afterChangeMessages(
  order: OrderForMessage,
  status: OrderStatus,
): OutgoingMessage[] {
  const cliente = customerName(order)
  const buttons = nextButtons(order, status)
  switch (status) {
    case 'accepted': {
      const detail = kitchenDetail(order)
      const prompt = 'Cuando empieces a prepararlo, toca el botón.'
      const together = `${detail}\n\n${prompt}`
      if (together.length <= INTERACTIVE_BODY_MAX) return [withButtons(together, buttons)]
      // Too long for an interactive body: the detail goes first as text.
      return [
        { kind: 'text', body: clip(detail, TEXT_MAX) },
        withButtons(`Cuando empieces a preparar el pedido de ${cliente}, toca el botón.`, buttons),
      ]
    }
    case 'preparing':
      return [
        withButtons(
          order.mode === 'pickup'
            ? `Cuando el pedido de ${cliente} esté listo para recoger, toca el botón.`
            : `Cuando salga el pedido de ${cliente}, toca el botón.`,
          buttons,
        ),
      ]
    case 'on_the_way':
      return [
        {
          kind: 'text',
          body: `Listo. ${capitalize(cliente)} confirma en la app cuando lo reciba.`,
        },
      ]
    case 'rejected':
      return [
        {
          kind: 'text',
          body: `Rechazaste el pedido de ${cliente}. Si fue un error, llámale: ${displayPhone(order.customerPhone)}`,
        },
      ]
    default:
      return []
  }
}

/**
 * A tap that did not move the order (repeated, from an old message, out of
 * order): say where the order is and offer the next step, if any.
 */
export function unchangedMessage(
  order: OrderForMessage,
  tapped: OrderAction,
  current: OrderStatus,
): OutgoingMessage {
  const buttons = nextButtons(order, current)
  if (tapped === 'rejected' && ['accepted', 'preparing', 'on_the_way'].includes(current)) {
    return withButtons(
      `Ya aceptaste el pedido de ${customerName(order)}. Si no se va a poder entregar, llámale al cliente: ${displayPhone(order.customerPhone)}`,
      buttons,
    )
  }
  if (current === 'pending') {
    return withButtons(
      `El pedido de ${customerName(order)} sigue pendiente: primero acéptalo o recházalo.`,
      buttons,
    )
  }
  return withButtons(
    `El pedido de ${customerName(order)} ya está ${statusLabel(current, order.mode)}.`,
    buttons,
  )
}

/** Reply to anything that is not a button: nobody reads this number. */
export const UNATTENDED_REPLY =
  'Este número solo manda los pedidos de Vichente y nadie lee los mensajes. Usa los botones del pedido, o llámale al cliente al teléfono que viene en el pedido.'

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
