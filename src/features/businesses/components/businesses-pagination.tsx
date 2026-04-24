import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  page: number
  pageCount: number
  buildHref: (page: number) => string
}

function buildRange(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) pages.push('ellipsis')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < pageCount - 1) pages.push('ellipsis')
  pages.push(pageCount)
  return pages
}

export function BusinessesPagination({ page, pageCount, buildHref }: Props) {
  if (pageCount <= 1) return null
  const items = buildRange(page, pageCount)
  const prevDisabled = page <= 1
  const nextDisabled = page >= pageCount

  return (
    <nav aria-label="Paginación" className="flex justify-center">
      <ul className="flex items-center gap-0.5">
        <li>
          <Link
            href={buildHref(Math.max(1, page - 1))}
            aria-label="Página anterior"
            aria-disabled={prevDisabled}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'default' }),
              'gap-1 pl-2.5',
              prevDisabled && 'pointer-events-none opacity-50',
            )}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Link>
        </li>

        {items.map((it, i) =>
          it === 'ellipsis' ? (
            <li key={`e-${i}`} aria-hidden className="flex size-8 items-center justify-center">
              <MoreHorizontalIcon className="h-4 w-4" />
            </li>
          ) : (
            <li key={it}>
              <Link
                href={buildHref(it)}
                aria-current={it === page ? 'page' : undefined}
                className={buttonVariants({
                  variant: it === page ? 'outline' : 'ghost',
                  size: 'icon',
                })}
              >
                {it}
              </Link>
            </li>
          ),
        )}

        <li>
          <Link
            href={buildHref(Math.min(pageCount, page + 1))}
            aria-label="Página siguiente"
            aria-disabled={nextDisabled}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'default' }),
              'gap-1 pr-2.5',
              nextDisabled && 'pointer-events-none opacity-50',
            )}
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
