'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'
import { NavItems } from './nav-items'

type Props = {
  userEmail: string | null
}

export function MobileTopbar({ userEmail }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <header className="bg-background sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          render={
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <Menu className="size-5" />
            </Button>
          }
        />
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-200" />
          <Dialog.Popup className="bg-background fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r p-4 shadow-lg transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
            <div className="mb-6 flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">Vichente Admin</Dialog.Title>
              <Dialog.Close
                render={
                  <Button variant="ghost" size="icon" aria-label="Cerrar menú">
                    <X className="size-5" />
                  </Button>
                }
              />
            </div>
            <NavItems onNavigate={() => setOpen(false)} />
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
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="text-sm font-semibold">Vichente Admin</span>
      <div className="w-8" />
    </header>
  )
}
