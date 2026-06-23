'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { approveRegistration, rejectRegistration } from '../actions'
import type { BusinessRegistration } from '../types'

export function RegistrationRowActions({ registration }: { registration: BusinessRegistration }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', registration.id)
      const result = await approveRegistration({ error: null }, fd)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', registration.id)
      const result = await rejectRegistration({ error: null }, fd)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const isPending = registration.status === 'pending' || registration.status === 'reviewed'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          {isPending && (
            <>
              <DropdownMenuItem onClick={handleApprove} disabled={pending}>
                Crear negocio
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReject} disabled={pending} variant="destructive">
                Rechazar
              </DropdownMenuItem>
            </>
          )}
          {!isPending && (
            <DropdownMenuItem disabled>
              {registration.status === 'approved' ? 'Ya aprobado' : 'Ya rechazado'}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
