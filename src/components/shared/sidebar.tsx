import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'
import type { Role } from '@/features/auth/queries'
import { NavItems } from './nav-items'

type Props = {
  userEmail: string | null
  role: Role
}

export function Sidebar({ userEmail, role }: Props) {
  return (
    <aside className="bg-background hidden h-full w-64 shrink-0 flex-col border-r p-4 lg:flex">
      <div className="mb-6 text-lg font-semibold">Vichente Admin</div>
      <NavItems role={role} />
      <div className="mt-6 space-y-2 border-t pt-4">
        <p className="text-muted-foreground truncate text-xs" title={userEmail ?? ''}>
          {userEmail}
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </aside>
  )
}
