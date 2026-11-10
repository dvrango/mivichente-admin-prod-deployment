'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export type BusinessTab = {
  href: string
  label: string
  /** Punto verde junto al nombre: la función está prendida para el público. */
  live?: boolean
  /** Número chico junto al nombre, como los platillos capturados. */
  count?: number
}

/**
 * Navegación entre las pantallas de un negocio. Son links por ruta, no tabs de
 * cliente: cada pantalla conserva su propia ruta, su `requireAdmin()` y su
 * carga de datos.
 */
export function BusinessTabs({ tabs }: { tabs: BusinessTab[] }) {
  const pathname = usePathname()
  // `returnTo` lo trae quien entró desde la lista filtrada o desde /campo, y el
  // guardado del tab Datos regresa ahí. Se arrastra entre tabs para no perderlo
  // por pasar a ver la promoción antes de guardar.
  const returnTo = useSearchParams().get('returnTo')
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  // El primer tab es la raíz del negocio: se marca solo con match exacto, si
  // no quedaría activo en todas las subpáginas.
  const root = tabs[0]?.href

  return (
    <nav aria-label="Secciones del negocio" className="-mx-4 border-b px-4 lg:mx-0 lg:px-0">
      <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-label="activa" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
