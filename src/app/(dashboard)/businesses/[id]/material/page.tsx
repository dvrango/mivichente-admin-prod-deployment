import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { getBusinessById, getBusinessServices } from '@/features/businesses/queries'
import { EtiquetaMenuPanel } from '@/features/material-grafico/components/etiqueta-menu-panel'
import { urlMenuImpresa } from '@/features/material-grafico/url-menu'

export default async function MaterialGraficoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, servicios] = await Promise.all([getBusinessById(id), getBusinessServices(id)])

  if (!business) notFound()

  const url = urlMenuImpresa(business.slug)
  const sinMenu = servicios.length === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material gráfico"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Material gráfico' },
        ]}
        description={`Etiqueta del menú de ${business.name}`}
        actions={
          <Link
            href={`/businesses/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Volver al negocio
          </Link>
        }
      />

      {/* Un negocio sin menú generaría una etiqueta que lleva a una página
          vacía. Como lo impreso no se corrige, se avisa antes de descargar. */}
      {sinMenu && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          <p className="font-medium">Este negocio no tiene menú cargado.</p>
          <p className="mt-1">
            El QR llevaría a una página sin platillos. Carga los items en{' '}
            <Link href={`/businesses/${id}`} className="underline">
              la ficha del negocio
            </Link>{' '}
            antes de imprimir.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          El QR apunta a{' '}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">{url}</code>
        </p>
        <p className="text-muted-foreground text-xs">
          Una vez impreso, el slug del negocio ya no se puede cambiar sin romper los códigos
          pegados.
        </p>
      </div>

      <EtiquetaMenuPanel nombre={business.name} slug={business.slug} url={url} />
    </div>
  )
}
