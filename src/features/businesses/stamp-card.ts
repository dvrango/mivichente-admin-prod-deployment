import { z } from 'zod'

// Tarjeta de sellos (tarea o3w5njyf0). El cliente escanea el QR del mostrador
// y se lleva una tarjeta; el dueño le da un sello por compra desde su panel y
// le canjea el premio cuando la llena. Aquí solo se configura: el interruptor,
// cuántos sellos llenan la tarjeta y cuál es el premio.
//
// Los límites repiten los check constraints de la migración
// `20261103120000_stamp_cards.sql`: si cambian allá, cambian aquí.
export const STAMP_CARD_STAMPS_MIN = 2
export const STAMP_CARD_STAMPS_MAX = 20
export const STAMP_CARD_REWARD_MAX = 40

const STAMPS_MESSAGE = `Los sellos deben ser un número entero entre ${STAMP_CARD_STAMPS_MIN} y ${STAMP_CARD_STAMPS_MAX}.`

// Llega como texto del input. Vacío es `null`: la columna no tiene default y un
// programa apagado puede no tener número todavía. El check de abajo exige
// número para prenderlo.
const stampsSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null
    const n = /^\d+$/.test(v) ? Number(v) : NaN
    if (!(n >= STAMP_CARD_STAMPS_MIN && n <= STAMP_CARD_STAMPS_MAX)) {
      ctx.addIssue({ code: 'custom', message: STAMPS_MESSAGE })
      return z.NEVER
    }
    return n
  })

export const stampCardSchema = z
  .object({
    active: z.boolean(),
    stampsRequired: stampsSchema,
    reward: z
      .string()
      .trim()
      .max(
        STAMP_CARD_REWARD_MAX,
        `El premio no puede pasar de ${STAMP_CARD_REWARD_MAX} caracteres.`,
      )
      .transform((v) => v || null),
  })
  .superRefine((value, ctx) => {
    if (!value.active) return
    if (value.stampsRequired === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['stampsRequired'],
        message: 'Para prender la tarjeta de sellos hay que decir cuántos sellos la llenan.',
      })
    }
    if (!value.reward) {
      ctx.addIssue({
        code: 'custom',
        path: ['reward'],
        message: 'Para prender la tarjeta de sellos hay que decir cuál es el premio.',
      })
    }
  })

export type StampCardValues = z.output<typeof stampCardSchema>

export function parseStampCardForm(formData: FormData) {
  return stampCardSchema.safeParse({
    active: formData.get('active') === 'on',
    stampsRequired: formData.get('stampsRequired') ?? '',
    reward: formData.get('reward') ?? '',
  })
}
