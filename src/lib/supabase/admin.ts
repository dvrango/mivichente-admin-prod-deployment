import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/lib/database.types'

/**
 * Cliente con service role. Bypasea RLS.
 * Usar SOLO en Server Actions / Route Handlers para operaciones que
 * requieran saltarse RLS (ej. limpieza administrativa). Nunca importar
 * desde un Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}
