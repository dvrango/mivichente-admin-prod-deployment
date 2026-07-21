import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { REASON_LABELS, type ReportReason } from '../schema'
import type { BusinessReport } from '../types'
import { ReportRowActions } from './report-row-actions'

const reasonVariant: Record<ReportReason, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  cerrado: 'destructive',
  datos_incorrectos: 'default',
  duplicado: 'secondary',
  spam: 'destructive',
  otro: 'outline',
}

export function ReportsTable({ reports }: { reports: BusinessReport[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Negocio</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Nota</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                Sin reportes.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.business ? (
                    <Link href={`/businesses/${r.business.id}`} className="hover:underline">
                      {r.business.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Negocio eliminado</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={reasonVariant[r.reason]}>{REASON_LABELS[r.reason]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-64 truncate text-sm">
                  {r.note ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  <ReportRowActions report={r} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
