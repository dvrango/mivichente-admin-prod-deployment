'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatMxPhone, MX_PHONE_DIGITS, normalizeMxPhone } from '@/lib/validation/phone'

type Props = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value?: string | null
  onChange?: (value: string) => void
}

export const PhoneInput = React.forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, placeholder = '618 123 4567', ...props },
  ref,
) {
  const display = formatMxPhone(value)

  return (
    <Input
      {...props}
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={placeholder}
      maxLength={MX_PHONE_DIGITS + 2}
      value={display}
      onChange={(e) => {
        onChange?.(normalizeMxPhone(e.target.value))
      }}
    />
  )
})
