import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import {
  getAllCategoryOptions,
  getBusinessById,
  getBusinessServices,
} from '@/features/businesses/queries'
import { EtiquetaMenuPanel } from '@/features/material-grafico/components/etiqueta-menu-panel'
import { TarjetaNegocioPanel } from '@/features/material-grafico/components/tarjeta-negocio-panel'
import { urlMenuImpresa, urlPerfilLegible } from '@/features/material-grafico/url-menu'

export default async function MaterialGraficoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, servicios, categorias] = await Promise.all([
    getBusinessById(id),
    getBusinessServices(id),
    getAllCategoryOptions(),
  ])

  if (!business) notFound()

  const url = urlMenuImpresa(business.slug)
  const sinMenu = servicios.length === 0
  const categoria = categorias.find((c) => c.id === business.category_id)?.name ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material gráfico"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Material gráfico' },
        ]}
        description={`Piezas para ${business.name}`}
        actions={
          <Link
            href={`/businesses/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Volver al negocio
          </Link>
        }
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Ya estamos en Vichente App</h2>
          <p className="text-muted-foreground text-sm">
            Para que el negocio lo publique en sus redes al darse de alta. Es la misma tarjeta que
            ve quien abre su ficha, así que lo que se corrija en el negocio se refleja aquí al
            regenerar.
          </p>
          {/* La imagen a propósito no lleva la URL escrita: nadie teclea una
              dirección que ve en una foto. El link se manda aparte para que el
              negocio lo pegue en el texto del post, donde sí es clickeable. */}
          <p className="text-muted-foreground text-sm">
            Mándale también este link para que lo pegue en el texto de la publicación:{' '}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">
              {urlPerfilLegible(business.slug)}
            </code>
          </p>
        </div>

        <TarjetaNegocioPanel
          slug={business.slug}
          fotoUrl={business.photo_url}
          nombre={business.name}
          categoria={categoria}
          verificado={business.is_verified}
        />
      </section>

      <hr />

      <h2 className="text-lg font-semibold">Etiqueta del menú</h2>

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
