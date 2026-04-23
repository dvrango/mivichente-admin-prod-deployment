import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'
import { NavItems } from './nav-items'

type Props = {
  userEmail: string | null
}

export function Sidebar({ userEmail }: Props) {
  return (
    <aside className="bg-background sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r p-4 lg:flex">
      <div className="mb-6 text-lg font-semibold">Vichente Admin</div>
      <NavItems />
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
