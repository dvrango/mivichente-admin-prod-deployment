import { ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OwnerLink } from '../links'
import { CopyLinkButton } from './copy-link-button'

export function OwnerLinks({ links }: { links: OwnerLink[] }) {
  if (links.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
        Tus links aparecen aquí cuando tu negocio esté publicado en Vichente.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {links.map((l) => (
        <li key={l.key} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold">{l.title}</h3>
            <p className="bg-muted rounded-md px-2.5 py-1.5 font-mono text-xs [overflow-wrap:anywhere]">
              {l.url.replace('https://', '')}
            </p>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="font-medium">Para qué sirve</dt>
              <dd className="text-muted-foreground">{l.purpose}</dd>
            </div>
            <div>
              <dt className="font-medium">Cómo usarlo</dt>
              <dd className="text-muted-foreground">{l.howTo}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <CopyLinkButton url={l.url} />
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'flex-1 sm:flex-none',
              )}
            >
              <ExternalLink className="size-4" />
              Abrir
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}
