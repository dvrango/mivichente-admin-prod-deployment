import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MissingBusinessReport } from '../types'
import { MissingReportRowActions } from './missing-report-row-actions'

export function MissingReportsTable({ reports }: { reports: MissingBusinessReport[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Buscó</TableHead>
            <TableHead>Nota</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-44">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                Sin avisos.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.query}</TableCell>
                {/* La nota se muestra completa: ahí viene "es don Chuy el de la
                    esquina", que es justo lo que sirve para ir a buscarlo. */}
                <TableCell className="text-muted-foreground max-w-80 text-sm whitespace-normal">
                  {r.note ?? '—'}
                </TableCell>
                <TableCell>
                  {/* Tecleada = alguien escribió el término. La otra llega de un
                      tap de categoría, un link o una búsqueda reciente. */}
                  <Badge variant={r.typed ? 'default' : 'outline'}>
                    {r.typed ? 'Tecleada' : 'Categoría o link'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  <MissingReportRowActions report={r} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
