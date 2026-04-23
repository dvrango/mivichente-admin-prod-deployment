import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type Props = {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <Fragment key={i}>
              <li>
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? 'text-foreground font-medium' : undefined}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
