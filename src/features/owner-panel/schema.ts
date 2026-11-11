import { z } from 'zod'
import { CARD_TOKEN } from './stamp-card'

/** Leer o sellar una tarjeta: solo el token que leyó la cámara. */
export const stampCardTokenSchema = z.object({
  token: z.string().regex(CARD_TOKEN, 'Código inválido.'),
})

/** Un intento de sello conserva su identidad aunque se pierda la respuesta. */
export const addStampSchema = stampCardTokenSchema.extend({
  operationId: z.string().uuid('Intento inválido.'),
})

/** Canjear: la vuelta que devolvió la lectura con ese mismo token. */
export const redeemStampCardSchema = z.object({
  cardId: z.string().uuid('Tarjeta inválida.'),
})
