'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseLoginForm } from './schema'

export type LoginState = { error: string | null }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = parseLoginForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) return { error: 'Credenciales inválidas.' }

  redirect('/businesses')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
