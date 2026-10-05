import { z } from 'zod'

// Promoción del negocio (tarea 8v3i4y8os). Solo se muestra en la ficha de la
// app; el negocio la aplica a mano cuando le llega el pedido por WhatsApp.
//
// Los límites repiten los check constraints de la migración
// `20261005120000_business_promo.sql`: si cambian allá, cambian aquí.
export const PROMO_TITLE_MAX = 80
export const PROMO_BODY_MAX = 2000

const DATE = /^\d{4}-\d{2}-\d{2}$/

// La regex sola deja pasar `2026-02-31`, que la DB rechaza con un error crudo.
function isRealDate(v: string): boolean {
  if (!DATE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export const promoSchema = z
  .object({
    active: z.boolean(),
    title: z
      .string()
      .trim()
      .max(PROMO_TITLE_MAX, `El título no puede pasar de ${PROMO_TITLE_MAX} caracteres.`)
      .transform((v) => v || null),
    body: z
      .string()
      // El navegador manda los saltos del textarea como \r\n: se normalizan
      // antes de medir, o cada renglón contaría doble contra el límite. Sin
      // trim interno: los renglones en blanco separan bloques en la app.
      .transform((v) => v.replace(/\r\n?/g, '\n').trim())
      .refine(
        (v) => v.length <= PROMO_BODY_MAX,
        `Los detalles no pueden pasar de ${PROMO_BODY_MAX} caracteres.`,
      )
      .transform((v) => v || null),
    ends_at: z
      .string()
      .trim()
      .refine((v) => v === '' || isRealDate(v), 'Fecha de fin inválida.')
      .transform((v) => v || null),
  })
  .superRefine((value, ctx) => {
    if (value.active && !value.title) {
      ctx.addIssue({
        code: 'custom',
        path: ['title'],
        message: 'Para prender la promoción necesita un título.',
      })
    }
  })

export type PromoValues = z.output<typeof promoSchema>

export function parsePromoForm(formData: FormData) {
  return promoSchema.safeParse({
    active: formData.get('active') === 'on',
    title: formData.get('title') ?? '',
    body: formData.get('body') ?? '',
    ends_at: formData.get('ends_at') ?? '',
  })
}

/**
 * "Hoy" en Durango como `YYYY-MM-DD`. Durango quedó en UTC-6 fijo desde que
 * México quitó el horario de verano (2022); la app usa el mismo offset en
 * `BusinessHoursUtils`. Se calcula a mano y no con `Intl` para que el server
 * de Vercel (UTC) y el browser den lo mismo.
 */
export function todayInDurango(now: Date = new Date()): string {
  return new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export type PromoStatus = 'none' | 'off' | 'expired' | 'live'

/**
 * Mismo criterio de "vigente" que la app: prendida, con título, y sin fecha de
 * fin o con `hoy <= fecha de fin` (inclusiva). Aquí solo sirve para que el
 * staff vea en qué estado quedó; quien decide mostrarla es la app.
 */
export function promoStatus(
  promo: { promo_active: boolean; promo_title: string | null; promo_ends_at: string | null },
  today: string = todayInDurango(),
): PromoStatus {
  if (!promo.promo_title) return 'none'
  if (!promo.promo_active) return 'off'
  if (promo.promo_ends_at && promo.promo_ends_at < today) return 'expired'
  return 'live'
}
