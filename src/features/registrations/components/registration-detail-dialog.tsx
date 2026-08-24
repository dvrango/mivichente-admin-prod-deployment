'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS, type RegistrationStatus } from '../schema'
import type { BusinessRegistration } from '../types'

/**
 * La solicitud completa. La tabla la muestra recortada —la descripción se trunca
 * y `notes` no aparece en ninguna columna—, así que quien revisa decidía sobre
 * lo que cupo en la fila.
 *
 * Sólo lee: las acciones llegan como callbacks desde `RegistrationRowActions`,
 * que es quien tiene la lógica de aprobar y rechazar. Se pintan aquí para no
 * obligar a cerrar el detalle y volver a buscar el menú de la fila.
 */
export function RegistrationDetailDialog({
  registration: r,
  open,
  onOpenChange,
  onApprove,
  onReject,
  pending,
}: {
  registration: BusinessRegistration
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: () => void
  onReject: () => void
  pending: boolean
}) {
  const accionable = r.status === 'pending' || r.status === 'reviewed'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        {/* max-h + scroll interno: una solicitud con muchas ofertas y descripción
            larga no cabe en la pantalla de un celular. */}
        <Dialog.Popup className="bg-background fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border shadow-lg transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
          <div className="flex items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">{r.business_name}</Dialog.Title>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {STATUS_LABELS[r.status as RegistrationStatus] ?? r.status}
                </Badge>
                {r.business_id && <Badge variant="secondary">Ya existe en el catálogo</Badge>}
                <span className="text-muted-foreground text-xs">
                  {new Date(r.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
            <Dialog.Close
              render={
                <Button variant="ghost" size="sm">
                  Cerrar
                </Button>
              }
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <dl className="grid gap-4 text-sm">
              {/* Lo primero que necesita quien revisa: si esto ya está en el
                  catálogo, la decisión es completar, no dar de alta. */}
              {r.business_id && (
                <div className="bg-muted/50 rounded-lg border p-3">
                  <p className="font-medium">El dueño encontró su negocio y pidió completarlo.</p>
                  <p className="text-muted-foreground mt-1">
                    Aprobar no crea nada: rellena los datos que le falten al negocio que ya está
                    cargado.
                  </p>
                  <Link
                    href={`/businesses/${r.business_id}`}
                    className="mt-2 inline-block underline underline-offset-4"
                  >
                    Ver el negocio en el catálogo
                  </Link>
                </div>
              )}

              <Campo label="Qué vende">
                {r.giro && (
                  <div className="text-muted-foreground mb-1.5 text-xs uppercase">
                    {r.giro === 'comida' ? 'Comida' : 'Comercial'}
                  </div>
                )}
                {r.offerings.length === 0 ? (
                  <span className="text-muted-foreground">No especificó</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.offerings.map((o) => (
                      <Badge key={o} variant="outline" className="font-normal">
                        {o}
                      </Badge>
                    ))}
                  </div>
                )}
              </Campo>

              <Campo label="Descripción">
                {r.description?.trim() ? (
                  // whitespace-pre-line: viene de un textarea público y los saltos
                  // de línea son del dueño, no ruido.
                  <p className="whitespace-pre-line">{r.description}</p>
                ) : (
                  <span className="text-muted-foreground">No especificó</span>
                )}
              </Campo>

              <Campo label="Teléfono del negocio">{r.phone}</Campo>

              <Campo label="Quién mandó la solicitud">
                <p>{r.contact_name}</p>
                {r.contact_phone ? (
                  <p className="text-muted-foreground">{r.contact_phone}</p>
                ) : (
                  <p className="text-muted-foreground">Sin teléfono de contacto aparte</p>
                )}
              </Campo>

              <Campo label="Municipio">{r.municipio}</Campo>

              {/* Se escribe al rechazar y hasta ahora no se mostraba en ningún
                  lado: la razón del rechazo quedaba enterrada en la base. */}
              {r.notes?.trim() && (
                <Campo label="Notas">
                  <p className="whitespace-pre-line">{r.notes}</p>
                </Campo>
              )}
            </dl>
          </div>

          {accionable && (
            <div className="bg-muted/50 flex flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onReject} disabled={pending}>
                Rechazar
              </Button>
              <Button onClick={onApprove} disabled={pending}>
                {r.business_id ? 'Completar negocio' : 'Crear negocio'}
              </Button>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}
