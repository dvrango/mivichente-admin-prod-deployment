'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
import { RegistrationDetailDialog } from './registration-detail-dialog'

export function RegistrationRowActions({ registration }: { registration: BusinessRegistration }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [detalleAbierto, setDetalleAbierto] = useState(false)

  function handleApprove() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', registration.id)
      const result = await approveRegistration({ error: null }, fd)
      if (result.error) {
        alert(result.error)
      } else {
        setDetalleAbierto(false)
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
        setDetalleAbierto(false)
        router.refresh()
      }
    })
  }

  const isPending = registration.status === 'pending' || registration.status === 'reviewed'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            {/* Va primero y sin condicionar al estado: leer la solicitud completa
                debe poder hacerse siempre, incluida una ya resuelta. */}
            <DropdownMenuItem onClick={() => setDetalleAbierto(true)}>
              Ver solicitud completa
            </DropdownMenuItem>
            {isPending && (
              <>
                <DropdownMenuSeparator />
                {/* El nombre cambia porque la acción es otra: con business_id
                    aprobar NO da de alta, actualiza el negocio que ya existe.
                    Decirle "Crear negocio" a eso invita a buscar el duplicado
                    que nunca se creó. */}
                <DropdownMenuItem onClick={handleApprove} disabled={pending}>
                  {registration.business_id ? 'Completar negocio existente' : 'Crear negocio'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReject} disabled={pending} variant="destructive">
                  Rechazar
                </DropdownMenuItem>
              </>
            )}
            {!isPending && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  {registration.status === 'approved' ? 'Ya aprobado' : 'Ya rechazado'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <RegistrationDetailDialog
        registration={registration}
        open={detalleAbierto}
        onOpenChange={setDetalleAbierto}
        onApprove={handleApprove}
        onReject={handleReject}
        pending={pending}
      />
    </>
  )
}
