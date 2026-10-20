import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getMenuItems } from '@/features/business-menu/queries'
import {
  getAllCategoryOptions,
  getBusinessById,
  getBusinessPhotos,
} from '@/features/businesses/queries'
import { EtiquetaMenuPanel } from '@/features/material-grafico/components/etiqueta-menu-panel'
import {
  RecursosNegocioPanel,
  type Recurso,
} from '@/features/material-grafico/components/recursos-negocio-panel'
import { TarjetaNegocioPanel } from '@/features/material-grafico/components/tarjeta-negocio-panel'
import { urlMenuImpresa, urlPerfilLegible } from '@/features/material-grafico/url-menu'

export default async function MaterialGraficoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // El menú completo, no `countMenuItems`: además de saber si hay menú, la
  // sección de fotos necesita la de cada platillo. Son a lo más ~80 filas.
  const [business, menu, fotos, categorias] = await Promise.all([
    getBusinessById(id),
    getMenuItems(id),
    getBusinessPhotos(id),
    getAllCategoryOptions(),
  ])

  if (!business) notFound()

  const url = urlMenuImpresa(business.slug)
  const sinMenu = menu.length === 0
  const categoria = categorias.find((c) => c.id === business.category_id)?.name ?? null

  // No hay columna de logo: `photo_url` es la primera foto de la galería, la
  // misma que el editor marca como «Portada». Llamarla «logo» sería adivinar.
  // Las fotos `kind = 'menu'` (el menú impreso) también salen: son material
  // real del negocio, y son dos en todo el directorio.
  const fotosNegocio: Recurso[] = fotos.map((f, i) => ({
    id: `foto-${i}`,
    url: f.url ?? f.previewUrl,
    etiqueta: f.caption || `Foto ${i + 1}`,
    portada: i === 0,
  }))
  // Sólo lo publicado: un anuncio de algo que el negocio ya no vende es peor
  // que no tener foto.
  const fotosPlatillos: Recurso[] = menu.flatMap((item) =>
    item.image_url && item.is_published
      ? [{ id: item.id, url: item.image_url, etiqueta: item.name }]
      : [],
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Material gráfico"
        breadcrumbs={[
          { label: 'Negocios', href: '/businesses' },
          { label: business.name, href: `/businesses/${id}` },
          { label: 'Material gráfico' },
        ]}
        description={`Fotos y piezas para ${business.name}`}
        actions={
          <Link
            href={`/businesses/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Volver al negocio
          </Link>
        }
      />

      {/* Va primero porque es el uso de todos los días: reunir el material real
          para pedirle un anuncio a ChatGPT. Las piezas de abajo se usan una
          vez por negocio, al darlo de alta. */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Fotos para anuncios</h2>
          <p className="text-muted-foreground text-sm">
            Las fotos reales del negocio. Descárgalas y adjúntalas en ChatGPT para que el anuncio
            use el logo y los productos de verdad.
          </p>
        </div>

        <RecursosNegocioPanel
          slug={business.slug}
          titulo="Fotos del negocio"
          recursos={fotosNegocio}
          vacio="Este negocio no tiene fotos. Pídele su logo y sus fotos al negocio; no las inventes en ChatGPT."
        />
        <RecursosNegocioPanel
          slug={business.slug}
          titulo="Fotos de platillos y productos"
          recursos={fotosPlatillos}
          vacio="Ningún platillo o producto tiene foto. Pídeselas al negocio; no las inventes en ChatGPT."
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Piezas listas para compartir</h2>
          <p className="text-muted-foreground text-sm">
            Se generan con los datos del negocio. Si algo sale mal, corrígelo en el negocio y vuelve
            a abrir esta página.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ya estamos en Vichente App</CardTitle>
              <CardDescription>
                Para que el negocio la publique en sus redes al darse de alta. Es la misma tarjeta
                que ve quien abre su perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* La imagen a propósito no lleva la URL escrita: nadie teclea una
                  dirección que ve en una foto. El link se manda aparte para que el
                  negocio lo pegue en el texto del post, donde sí es clickeable. */}
              <p className="text-muted-foreground text-sm">
                Mándale también este link para que lo pegue en el texto de la publicación:{' '}
                <code className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">
                  {urlPerfilLegible(business.slug)}
                </code>
              </p>
              <TarjetaNegocioPanel
                slug={business.slug}
                fotoUrl={business.photo_url}
                nombre={business.name}
                categoria={categoria}
                verificado={business.is_verified}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Etiqueta del menú</CardTitle>
              <CardDescription>
                El QR que se imprime y se pega en la mesa o el mostrador para abrir el menú.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Un negocio sin menú generaría una etiqueta que lleva a una página
                  vacía. Como lo impreso no se corrige, se avisa antes de descargar. */}
              {sinMenu && (
                <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
                  <p className="font-medium">Este negocio no tiene menú cargado.</p>
                  <p className="mt-1">
                    El QR llevaría a una página sin platillos. Carga los items en{' '}
                    <Link href={`/businesses/${id}`} className="underline">
                      el perfil del negocio
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
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
