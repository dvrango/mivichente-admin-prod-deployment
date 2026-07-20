'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMxPhone, normalizeMxPhone } from '@/lib/validation/phone'
import { createFieldBusiness } from '../actions'

/**
 * Alta mínima: nombre y teléfono, nada más. `businesses.phone` es NOT NULL, y
 * preguntar el teléfono de entrada es natural en la conversación. Todo lo demás
 * se llena ya dentro de la pantalla de captura.
 */
export function FieldNewBusiness({ initialName }: { initialName: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ready = name.trim().length > 0 && normalizeMxPhone(phone).length === 10

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createFieldBusiness({ name, phone })
      if (result.error || !result.id) {
        setError(result.error ?? 'No se pudo crear el negocio.')
        return
      }
      // `replace`, nunca `push`: con push, volver atrás y reenviar crea un
      // negocio duplicado.
      router.replace(`/campo/${result.id}`)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="bg-background sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-3">
        <Link
          href="/campo"
          className="text-muted-foreground hover:text-foreground -ml-1 flex size-9 items-center justify-center rounded-lg"
          aria-label="Volver a la búsqueda"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Negocio nuevo</h1>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <label className="mb-1.5 block text-sm font-medium" htmlFor="field-name">
          Nombre
        </label>
        <input
          id="field-name"
          value={name}
          autoFocus={!initialName}
          onChange={(e) => setName(e.target.value)}
          enterKeyHint="next"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mb-5 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
        />

        <label className="mb-1.5 block text-sm font-medium" htmlFor="field-phone">
          Teléfono
        </label>
        <input
          id="field-phone"
          type="tel"
          inputMode="tel"
          autoFocus={!!initialName}
          value={formatMxPhone(phone)}
          onChange={(e) => setPhone(normalizeMxPhone(e.target.value))}
          placeholder="618 123 4567"
          enterKeyHint="done"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
        />

        {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      </div>

      <div className="bg-background sticky bottom-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          onClick={submit}
          disabled={!ready || pending}
          className="h-14 w-full rounded-xl text-base"
        >
          {pending ? 'Creando…' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
