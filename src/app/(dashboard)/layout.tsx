import { redirect } from 'next/navigation'
import { MobileTopbar } from '@/components/shared/mobile-topbar'
import { Sidebar } from '@/components/shared/sidebar'
import { getCurrentUser } from '@/features/auth/queries'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
      <Sidebar userEmail={user.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        <MobileTopbar userEmail={user.email ?? null} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
