import type { ReactNode } from 'react'
import { InfoTip } from './info-tip'

type Props = {
  title: string
  /** Explicación de la sección. Va detrás del ícono de info, no en un párrafo. */
  info?: ReactNode
  actions?: ReactNode
}

/**
 * Encabezado de una sección dentro de una pantalla que ya tiene su propio
 * header, como los tabs de `/businesses/[id]`. Es más chico que `PageHeader` y
 * no lleva breadcrumbs.
 */
export function SectionHeader({ title, info, actions }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate text-lg font-semibold">{title}</h2>
        {info && <InfoTip>{info}</InfoTip>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
