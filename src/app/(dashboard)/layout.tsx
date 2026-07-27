import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/shared/bottom-nav'
import { MobileTopbar } from '@/components/shared/mobile-topbar'
import { Sidebar } from '@/components/shared/sidebar'
import { getCurrentProfile } from '@/features/auth/queries'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
      <Sidebar userEmail={profile.email} role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        <MobileTopbar userEmail={profile.email} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        {/* Hermana de <main>, no encima: la barra ocupa su propio espacio en la
            columna, así que nunca tapa el final del contenido y no hace falta
            compensar con padding. */}
        <BottomNav role={profile.role} />
      </div>
    </div>
  )
}
