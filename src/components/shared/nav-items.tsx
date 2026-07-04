'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Role } from '@/features/auth/queries'
import { navGroupsForRole } from './nav-config'

type Props = {
  role: Role
  onNavigate?: () => void
}

export function NavItems({ role, onNavigate }: Props) {
  const pathname = usePathname()
  const groups = navGroupsForRole(role)

  return (
    <nav className="flex flex-1 flex-col gap-4 text-sm">
      {groups.map((group, i) => (
        <div key={group.label ?? i} className="flex flex-col gap-1">
          {group.label && (
            <div className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium tracking-wide uppercase">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
