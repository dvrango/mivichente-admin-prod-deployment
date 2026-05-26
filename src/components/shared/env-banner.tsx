import { env } from '@/lib/env'

export function EnvBanner() {
  if (env.NEXT_PUBLIC_APP_ENV !== 'local') return null

  return (
    <div className="w-full bg-amber-400 text-amber-950 text-center text-xs font-semibold py-1 px-4 tracking-wide">
      ⚠ AMBIENTE LOCAL — conectado a Supabase de desarrollo
    </div>
  )
}
