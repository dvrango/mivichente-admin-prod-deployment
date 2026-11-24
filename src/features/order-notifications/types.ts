/** Steps the restaurant can move an order to from WhatsApp (see set_order_status). */
export const ORDER_ACTIONS = ['accepted', 'rejected', 'preparing', 'on_the_way'] as const
export type OrderAction = (typeof ORDER_ACTIONS)[number]

export type OrderStatus = 'pending' | OrderAction | 'delivered'
export type OrderMode = 'delivery' | 'pickup'
export type NotifyStatus = 'pending' | 'sending' | 'sent' | 'failed'

/** One line of `orders.items`, the snapshot create_order writes. */
export type OrderItem = {
  name: string
  variant_name: string | null
  options: { group_name: string; name: string }[]
  quantity: number
  note: string | null
}

/** What the messages need from an order and its business. */
export type OrderForMessage = {
  id: string
  status: OrderStatus
  mode: OrderMode
  items: OrderItem[]
  subtotalCents: number
  deliveryFeeCents: number | null
  totalCents: number
  customerName: string | null
  customerPhone: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryDirections: string | null
  deliveryReferences: string | null
  paysWith: string | null
  /** The business WhatsApp, 10 digits; null if the business has none anymore. */
  businessWhatsapp: string | null
}

export type ReplyButton = { id: string; title: string }

/** A message to the restaurant, already shaped for the Cloud API. */
export type OutgoingMessage =
  | { kind: 'text'; body: string }
  | { kind: 'buttons'; body: string; buttons: ReplyButton[] }
  | {
      kind: 'template'
      name: string
      headerParams: Record<string, string>
      bodyParams: Record<string, string>
      /** Quick reply payloads, in the order of the template buttons. */
      buttonPayloads: string[]
      /** Comes back in Meta's delivery statuses, to find the order. */
      callbackData: string
    }

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string }
