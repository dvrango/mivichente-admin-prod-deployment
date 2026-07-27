import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'

type Props = {
  userEmail: string | null
}

/**
 * Topbar de mobile. Ya NO trae hamburguesa: la navegación vive en la barra
 * inferior (`BottomNav`), al alcance del pulgar. Aquí sólo queda la identidad de
 * la cuenta y el cierre de sesión, que casi nunca se tocan.
 */
export function MobileTopbar({ userEmail }: Props) {
  return (
    <header className="bg-background sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden">
      <span className="text-sm font-semibold">Vichente Admin</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground max-w-40 truncate text-xs" title={userEmail ?? ''}>
          {userEmail}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
            <LogOut className="size-5" />
          </Button>
        </form>
      </div>
    </header>
  )
}
