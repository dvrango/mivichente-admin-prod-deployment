'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'

type Props = Omit<React.ComponentProps<'input'>, 'type' | 'inputMode'>

/**
 * Campo de precio en pesos. Es de TEXTO a propósito, no `type="number"`: un
 * input numérico que recibe "$15" —Safari y Firefox dejan teclearlo— entrega
 * `value=""`, y el vacío es un valor válido (sin costo / sin precio), así que el
 * precio se perdía en silencio. Aquí llega tal cual lo escribieron y el schema
 * del formulario lo limpia o lo rechaza con un mensaje.
 *
 * `inputMode="decimal"` conserva el teclado numérico en el celular.
 */
export const PriceInput = React.forwardRef<HTMLInputElement, Props>(
  function PriceInput(props, ref) {
    return <Input {...props} ref={ref} type="text" inputMode="decimal" autoComplete="off" />
  },
)
