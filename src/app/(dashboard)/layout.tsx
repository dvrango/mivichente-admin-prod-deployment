import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shared/sidebar'
import { getCurrentUser } from '@/features/auth/queries'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-dvh">
      <Sidebar userEmail={user.email ?? null} />
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
