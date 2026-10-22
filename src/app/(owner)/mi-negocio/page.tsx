import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { OwnerBusinessView } from '@/features/owner-panel/components/owner-business-view'
import { getOwnerBusinesses, getOwnerBusinessSnapshot } from '@/features/owner-panel/queries'
import { vichenteWhatsappLink } from '@/features/owner-panel/whatsapp'

export const metadata = { title: 'Mi negocio' }

export default async function MiNegocioPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>
}) {
  const { negocio } = await searchParams
  const businesses = await getOwnerBusinesses()

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <h1 className="text-lg font-semibold">Tu cuenta todavía no tiene negocio</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Escríbenos por WhatsApp y lo ligamos a tu cuenta.
        </p>
        <a
          href={vichenteWhatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: 'sm' })}
        >
          <MessageCircle className="size-4" />
          Escribir a Vichente
        </a>
      </div>
    )
  }

  // Solo se elige entre los negocios que la DB dice que son suyos. Un id ajeno
  // en la URL cae al primero; la función igual devolvería null para ese id.
  const selected = businesses.find((b) => b.id === negocio) ?? businesses[0]
  const snapshot = await getOwnerBusinessSnapshot(selected.id)

  return (
    <div className="flex flex-col gap-4">
      {businesses.length > 1 && (
        <nav aria-label="Tus negocios" className="flex flex-wrap gap-2">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/mi-negocio?negocio=${b.id}`}
              aria-current={b.id === selected.id ? 'page' : undefined}
              className={buttonVariants({
                variant: b.id === selected.id ? 'default' : 'outline',
                size: 'sm',
              })}
            >
              {b.name}
            </Link>
          ))}
        </nav>
      )}
      {snapshot ? (
        <OwnerBusinessView snapshot={snapshot} />
      ) : (
        <p className="text-muted-foreground text-sm">No encontramos este negocio.</p>
      )}
    </div>
  )
}
