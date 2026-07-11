import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/lib/database.types'

// Cliente sin sesión: siempre pega como rol `anon`, igual que un usuario real
// de la app mobile (no logueado). A diferencia de createBrowserClient (@/lib/
// supabase/client), este NO lee la cookie de sesión del reviewer, así que RLS
// aplica la policy `businesses_public_read` (todos los municipios) en vez de
// `businesses_select` (scopeada al municipio del reviewer). Usar donde se
// necesite simular la vista real del usuario final (ej. simulador de búsqueda).
export function createAnonClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  )
}
