import { requireAdmin } from '@/features/auth/queries'

// Solicitudes es sólo-admin (el reviewer no procesa altas desde la app).
export default async function RegistrationsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
