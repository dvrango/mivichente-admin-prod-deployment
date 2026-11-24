import { z } from 'zod'

/** Body of POST /api/orders/notify: the secret token create_order returned. */
export const notifyOrderSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16,64}$/),
})
