import { requireAdmin } from '@/features/auth/queries'

// Métricas es sólo-admin, y acá el guard NO es defensa en profundidad: es la
// única protección que hay. `getWeeklyMetrics()` lee con service role, o sea
// por fuera de RLS, así que si esta capa falta no hay nada abajo que detenga a
// un reviewer que escriba la URL a mano — que es exactamente lo que pasaba
// hasta el 2026-09-11 (mikitasks `eantgj6l5`).
//
// El `adminOnly` de `nav-config` sólo esconde el link del menú. Esconder no es
// proteger.
export default async function MetricsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
