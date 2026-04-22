import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 border-r p-4 lg:block">
        <div className="mb-6 text-lg font-semibold">Vichente Admin</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/businesses" className="rounded px-2 py-1.5 hover:bg-accent">
            Negocios
          </Link>
          <Link href="/categories" className="rounded px-2 py-1.5 hover:bg-accent">
            Categorías
          </Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
