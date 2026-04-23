import { redirect } from 'next/navigation'
import { MobileTopbar } from '@/components/shared/mobile-topbar'
import { Sidebar } from '@/components/shared/sidebar'
import { getCurrentUser } from '@/features/auth/queries'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar userEmail={user.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar userEmail={user.email ?? null} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
