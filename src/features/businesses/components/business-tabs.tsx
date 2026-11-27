'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export type BusinessTab = {
  href: string
  label: string
  /** Green dot next to the label: the feature is enabled for the public. */
  live?: boolean
  /** Small count next to the label, such as the number of menu items. */
  count?: number
}

/**
 * Route-based navigation between business pages. Each page keeps its own
 * route, `requireAdmin()` guard, and data loading.
 */
export function BusinessTabs({ tabs }: { tabs: BusinessTab[] }) {
  const pathname = usePathname()
  const listRef = useRef<HTMLUListElement>(null)
  // Mobile tabs overflow with a hidden scrollbar. Keep the active tab visible
  // when opening a subpage directly.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  // Preserve the filtered list or /campo return destination across tabs so
  // saving the details form still returns to the original entry point.
  const returnTo = useSearchParams().get('returnTo')
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  // The first tab is the business root and must only match its exact pathname.
  const root = tabs[0]?.href

  return (
    <nav aria-label="Secciones del negocio" className="-mx-4 border-b px-4 lg:mx-0 lg:px-0">
      <ul
        ref={listRef}
        className="relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.href === root ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={`${tab.href}${query}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'border-primary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
                    {tab.count}
                  </span>
                )}
                {tab.live && (
                  <>
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                    <span className="sr-only">(activa)</span>
                  </>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
