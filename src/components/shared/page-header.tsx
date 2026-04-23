import type { ReactNode } from 'react'
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs'

type Props = {
  title: string
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

export function PageHeader({ title, description, actions, breadcrumbs }: Props) {
  return (
    <div className="space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
