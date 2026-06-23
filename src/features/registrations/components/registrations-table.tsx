import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { STATUS_LABELS, type RegistrationStatus } from '../schema'
import type { BusinessRegistration } from '../types'
import { RegistrationRowActions } from './registration-row-actions'

const statusVariant: Record<
  RegistrationStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  pending: 'default',
  reviewed: 'secondary',
  approved: 'outline',
  rejected: 'destructive',
}

export function RegistrationsTable({ registrations }: { registrations: BusinessRegistration[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
            <TableHead>Negocio</TableHead>
            <TableHead>Qué hace</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Municipio</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                Sin solicitudes en este estado.
              </TableCell>
            </TableRow>
          ) : (
            registrations.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <RegistrationRowActions registration={r} />
                </TableCell>
                <TableCell className="font-medium">{r.business_name}</TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {r.description}
                </TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{r.contact_name}</div>
                    {r.contact_phone && (
                      <div className="text-muted-foreground">{r.contact_phone}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{r.municipio}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[r.status as RegistrationStatus]}>
                    {STATUS_LABELS[r.status as RegistrationStatus] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
