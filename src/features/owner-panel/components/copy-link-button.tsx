'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CopyState = 'idle' | 'copied' | 'failed'

// Copiar es lo que el dueño va a hacer con el link: pegarlo en WhatsApp o en su
// bio. Si el navegador niega el portapapeles (http, WebView viejo), el link
// sigue a la vista para copiarlo a mano.
export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<CopyState>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <Button type="button" size="sm" onClick={copy} className="flex-1 sm:flex-none">
      {state === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
      {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Cópialo a mano' : 'Copiar link'}
    </Button>
  )
}
