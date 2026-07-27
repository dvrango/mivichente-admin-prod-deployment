'use client'

import { Dialog } from '@base-ui/react/dialog'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Role } from '@/features/auth/queries'
import { cn } from '@/lib/utils'
import { mobileNavForRole, type NavItem } from './nav-config'

/**
 * Navegación de mobile (`< lg`). Sustituye a la hamburguesa de la topbar: en la
 * calle, con una mano, la esquina superior izquierda es el punto más lejos del
 * pulgar y costaba dos taps llegar a cualquier lado.
 *
 * Sólo vive en `(dashboard)`. El modo campo (`(field)`) es pantalla completa a
 * propósito y NO lleva barra — sale con el botón explícito de su header.
 */
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const { primary, more } = mobileNavForRole(role)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const moreIsActive = more.some((item) => isActive(item.href))

  return (
    // NO va `fixed`: el shell ya es de alto fijo (`html.h-dvh` + `body.overflow-hidden`)
    // y el único que scrollea es `<main>`, así que la barra se queda abajo por
    // estar en el flujo normal. Con `fixed` Safari en iPhone la pintaba angosta
    // y a media pantalla (se ancla al layout viewport, que no coincide con lo
    // que se ve al hacer zoom o al aparecer/desaparecer su toolbar).
    //
    // El padding inferior lleva piso propio (0.5rem): con la toolbar de Safari
    // visible `env(safe-area-inset-bottom)` vale 0 y la barra quedaba apretada
    // contra el chrome del navegador.
    <nav
      aria-label="Navegación principal"
      className="bg-background z-30 flex shrink-0 border-t pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      {primary.map((item) => (
        <BottomNavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}

      {more.length > 0 && (
        <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
          <Dialog.Trigger
            render={
              <button
                type="button"
                className={cn(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1.5 px-1 py-1',
                  moreIsActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <MoreHorizontal className="size-6" />
                <span className="text-xs leading-none font-medium">Más</span>
              </button>
            }
          />
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <Dialog.Popup className="bg-background fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg transition-transform duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
              <Dialog.Title className="mb-3 text-sm font-semibold">Más</Dialog.Title>
              <ul className="flex flex-col">
                {more.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                        className={cn(
                          'flex min-h-14 items-center gap-3 rounded-lg px-2 text-base',
                          isActive(item.href) ? 'text-foreground font-medium' : 'text-foreground',
                        )}
                      >
                        <Icon className="size-5 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </nav>
  )
}

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-1.5 px-1 py-1',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-6" />
      <span className="text-xs leading-none font-medium">{item.shortLabel ?? item.label}</span>
    </Link>
  )
}
