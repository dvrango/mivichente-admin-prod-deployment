import { z } from 'zod'

// Opiniones con descuento (tarea 8ywy3gpla). El cliente escanea el QR del
// local, deja una opinión privada y recibe un descuento para su siguiente
// compra. Aquí solo se configura: el interruptor, qué da y cuántos días vale.
//
// Los límites repiten los check constraints de la migración
// `20261010130000_business_feedback_coupons.sql`: si cambian allá, cambian aquí.
export const FEEDBACK_REWARD_BENEFIT_MAX = 40
export const FEEDBACK_REWARD_DAYS_MIN = 1
export const FEEDBACK_REWARD_DAYS_MAX = 365
export const FEEDBACK_REWARD_DAYS_DEFAULT = 30

const DAYS_MESSAGE = `Los días deben ser un número entero entre ${FEEDBACK_REWARD_DAYS_MIN} y ${FEEDBACK_REWARD_DAYS_MAX}.`

export const feedbackRewardSchema = z
  .object({
    active: z.boolean(),
    benefit: z
      .string()
      .trim()
      .max(
        FEEDBACK_REWARD_BENEFIT_MAX,
        `El descuento no puede pasar de ${FEEDBACK_REWARD_BENEFIT_MAX} caracteres.`,
      )
      .transform((v) => v || null),
    // Llega como texto del input. Vacío no cae al default: el campo ya trae 30,
    // así que vacío es un error de captura que conviene ver.
    days: z
      .string()
      .trim()
      .regex(/^\d+$/, DAYS_MESSAGE)
      .transform(Number)
      .refine((v) => v >= FEEDBACK_REWARD_DAYS_MIN && v <= FEEDBACK_REWARD_DAYS_MAX, DAYS_MESSAGE),
  })
  .superRefine((value, ctx) => {
    if (value.active && !value.benefit) {
      ctx.addIssue({
        code: 'custom',
        path: ['benefit'],
        message: 'Para prender las opiniones con descuento hay que decir qué descuento da.',
      })
    }
  })

export type FeedbackRewardValues = z.output<typeof feedbackRewardSchema>

export function parseFeedbackRewardForm(formData: FormData) {
  return feedbackRewardSchema.safeParse({
    active: formData.get('active') === 'on',
    benefit: formData.get('benefit') ?? '',
    days: formData.get('days') ?? '',
  })
}
