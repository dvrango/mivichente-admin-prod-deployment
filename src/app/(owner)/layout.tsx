import Image from 'next/image'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PendingAccountNotice } from '@/components/shared/pending-account-notice'
import { signOut } from '@/features/auth/actions'
import { getCurrentProfile } from '@/features/auth/queries'

// Grupo de rutas hermano de (dashboard) y (field): el dueño no ve el chrome del
// staff. Solo lectura — la DB le niega cualquier escritura de todos modos, y
// sus datos le llegan por owner_business_snapshot(), no por las tablas.

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'pending') return <PendingAccountNotice />
  if (profile.role !== 'owner') redirect('/businesses')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="bg-background flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="flex items-center gap-2">
          <Image src="/brand/vichente-isotipo.png" alt="" width={28} height={28} />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Vichente</span>
            <span className="text-muted-foreground text-xs">Mi negocio</span>
          </span>
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="text-muted-foreground max-w-48 truncate text-xs"
            title={profile.email ?? ''}
          >
            {profile.email}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
              <LogOut className="size-5" />
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  )
}
