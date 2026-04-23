import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'

type Props = {
  userEmail: string | null
}

export function Sidebar({ userEmail }: Props) {
  return (
    <aside className="hidden w-60 flex-col border-r p-4 lg:flex">
      <div className="mb-6 text-lg font-semibold">Vichente Admin</div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        <Link href="/businesses" className="hover:bg-accent rounded px-2 py-1.5">
          Negocios
        </Link>
        <Link href="/categories" className="hover:bg-accent rounded px-2 py-1.5">
          Categorías
        </Link>
      </nav>
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
