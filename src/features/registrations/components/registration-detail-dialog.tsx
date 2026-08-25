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

              {/* La foto se ve ANTES de aprobar, no después: es la única
                  revisión humana que hay sobre algo que entró por un formulario
                  abierto. Vive en un bucket privado, así que llega como URL
                  firmada desde la query y no está publicada en ningún lado
                  mientras se decide. */}
              <Campo
                label={
                  (r.photo_paths?.length ?? 0) > 1
                    ? `Fotos que subió el dueño (${r.photo_paths.length})`
                    : 'Foto que subió el dueño'
                }
              >
                {(r.photo_preview_urls?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {r.photo_preview_urls!.map((url, i) => (
                      <div key={url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Foto ${i + 1} de ${r.business_name}`}
                          className="bg-muted max-h-48 w-full rounded-lg border object-contain"
                        />
                        {/* La primera va a ser la portada del negocio y la que
                            sale en la tarjeta: se marca para que quien revisa
                            sepa cuál pesa más al decidir. */}
                        {i === 0 && (
                          <Badge className="absolute top-1.5 left-1.5" variant="secondary">
                            Principal
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (r.photo_paths?.length ?? 0) > 0 ? (
                  // Hay paths pero ninguno se pudo firmar. En una solicitud ya
                  // resuelta eso es lo esperado, no una falla: al aprobar las
                  // fotos se copian al negocio y al rechazar se borran, y en los
                  // dos casos el staging queda vacío. Decir "recarga la página"
                  // ahí manda a recargar en vano.
                  <span className="text-muted-foreground">
                    {r.status === 'approved' || r.status === 'rejected'
                      ? `Subió ${r.photo_paths.length === 1 ? 'una foto' : `${r.photo_paths.length} fotos`}. Ya no se ${r.photo_paths.length === 1 ? 'muestra' : 'muestran'} aquí: al ${r.status === 'approved' ? 'aprobar se copiaron al negocio' : 'rechazar se borraron'}.`
                      : 'Subió fotos, pero no se pudieron cargar. Recarga la página.'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No subió fotos</span>
                )}
              </Campo>

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

              <Campo label="Dirección">
                {r.address?.trim() ? (
                  <p>{r.address}</p>
                ) : (
                  <span className="text-muted-foreground">No especificó</span>
                )}
              </Campo>

              {/* El horario NO se copia solo al negocio: `business_hours` son
                  filas por día y soporta turnos partidos, así que se le pidió al
                  dueño en texto libre y quien aprueba lo captura en el editor.
                  Por eso se muestra destacado — si nadie lo lee aquí, el dato se
                  queda enterrado en la solicitud. */}
              <Campo label="Horario (lo dijo así, hay que capturarlo)">
                {r.hours_note?.trim() ? (
                  <p className="bg-muted/50 rounded-md border px-3 py-2">{r.hours_note}</p>
                ) : (
                  <span className="text-muted-foreground">No especificó</span>
                )}
              </Campo>

              <Campo label="Facebook / Instagram">
                {r.social_url?.trim() ? (
                  <p className="break-all">{r.social_url}</p>
                ) : (
                  <span className="text-muted-foreground">No especificó</span>
                )}
              </Campo>

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
