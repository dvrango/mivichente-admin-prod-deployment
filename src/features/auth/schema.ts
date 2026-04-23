import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export function parseLoginForm(formData: FormData) {
  return loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
}
