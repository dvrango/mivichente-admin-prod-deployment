import { z } from 'zod'

export const MX_PHONE_DIGITS = 10

export function normalizeMxPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length <= MX_PHONE_DIGITS) return digits
  if (digits.startsWith('521')) return digits.slice(3, 3 + MX_PHONE_DIGITS)
  if (digits.startsWith('52')) return digits.slice(2, 2 + MX_PHONE_DIGITS)
  return digits.slice(0, MX_PHONE_DIGITS)
}

export function formatMxPhone(value: string | null | undefined): string {
  const d = normalizeMxPhone(value)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

export const mxPhoneSchema = z
  .string()
  .trim()
  .min(1, 'El teléfono es requerido.')
  .transform(normalizeMxPhone)
  .refine((v) => v.length === MX_PHONE_DIGITS, 'El teléfono debe tener 10 dígitos.')

// Teléfono que puede quedar vacío (ej. el del dueño). Vacío → null en la DB;
// si se escribe algo, se exige el mismo formato de 10 dígitos.
export const optionalMxPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeMxPhone)
  .refine((v) => v === '' || v.length === MX_PHONE_DIGITS, 'El teléfono debe tener 10 dígitos.')
  .transform((v) => (v === '' ? null : v))
  // `.nullable()` para que el tipo de ENTRADA también acepte null, igual que el
  // resto de los campos opcionales del form: si no, react-hook-form tipa el
  // resolver con una entrada distinta a `BusinessFormInput` y no compila.
  .nullable()
