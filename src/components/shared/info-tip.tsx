'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  /** Nombre accesible del ícono; por default «Más información». */
  label?: string
  className?: string
}

/**
 * Ícono de info que abre una explicación corta. Reemplaza los párrafos de
 * ayuda fijos para que las pantallas no se lean como manual.
 *
 * Es popover y no tooltip a propósito: el admin se usa desde el celular en
 * campo, y un tooltip solo abre con hover. Este abre con tap, con hover y con
 * foco de teclado.
 *
 * El trigger es un `<span>` y no un `<button>`: los forms en solo lectura
 * envuelven todo en `<fieldset disabled>`, que deshabilita cualquier botón de
 * adentro, y la ayuda tiene que seguir abriendo ahí.
 */
export function InfoTip({ children, label = 'Más información', className }: Props) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        nativeButton={false}
        render={<span />}
        aria-label={label}
        className={cn(
          'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2',
          className,
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-xs leading-relaxed font-normal">
        {children}
      </PopoverContent>
    </Popover>
  )
}
