import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { Badge } from '@/components/ui/badge'
import type { BusinessWithAuthors } from '../queries'

type Props = {
  business: Pick<
    BusinessWithAuthors,
    | 'name'
    | 'slug'
    | 'photo_url'
    | 'municipio'
    | 'colonia'
    | 'is_active'
    | 'is_verified'
    | 'is_featured'
    | 'is_demo'
  >
  readOnly: boolean
}

/**
 * Encabezado común de todas las pantallas de un negocio (`[id]/layout.tsx`).
 * Solo muestra el estado: los interruptores viven en la tarjeta «Estado» del
 * tab Datos, para que aquí no se mezclen botones que navegan con botones que
 * escriben.
 */
export function BusinessHeader({ business, readOnly }: Props) {
  const place = [business.colonia, business.municipio].filter(Boolean).join(', ')

  return (
    <div className="space-y-3">
      <Breadcrumbs items={[{ label: 'Negocios', href: '/businesses' }, { label: business.name }]} />
      <div className="flex items-center gap-3">
        {business.photo_url ? (
          <Image
            src={business.photo_url}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-lg text-lg font-semibold">
            {business.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{business.name}</h1>
            {!business.is_active && <Badge variant="destructive">Oculto</Badge>}
            {business.is_verified && <Badge className="bg-blue-500 text-white">Verificado</Badge>}
            {business.is_featured && <Badge variant="secondary">Recomendado</Badge>}
            {business.is_demo && (
              <Badge variant="outline" title="Se abre por link; no sale en el directorio">
                Demo · fuera del directorio
              </Badge>
            )}
            {readOnly && <Badge variant="outline">Solo lectura</Badge>}
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
            {place && <span>{place}</span>}
            {/* Un negocio oculto no lo puede leer el cliente anónimo: el link
                daría 404, así que solo se muestra el slug. */}
            {business.slug &&
              (business.is_active ? (
                <a
                  href={`https://vichente.com/${business.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-1"
                >
                  vichente.com/{business.slug}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : (
                <span>vichente.com/{business.slug}</span>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
