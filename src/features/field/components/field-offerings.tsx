'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const SEPARATORS = /[,;·\n]/

/**
 * Ofertas del negocio (`businesses.offerings`).
 *
 * Es el campo de mayor palanca de toda la captura: un negocio sin offerings no
 * aparece en NINGUNA búsqueda, y la RPC `search_businesses` los pondera 3.0 vs
 * 1.0 de la categoría.
 *
 * El corte por coma es lo que lo hace rápido en la calle: se toca el micrófono
 * del teclado, se dicta "tacos, burritos, agua fresca" y salen tres chips de un
 * jalón. Sin eso hay que teclear cada palabra, y en la práctica no se hace.
 */
export function FieldOfferings({
  value,
  suggestions,
  onChange,
  onBlur,
}: {
  value: string[]
  suggestions: string[]
  onChange: (next: string[]) => void
  onBlur: () => void
}) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const parts = raw
      .split(SEPARATORS)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return

    const existing = new Set(value.map((v) => v.toLowerCase()))
    const next = [...value]
    for (const part of parts) {
      if (existing.has(part.toLowerCase())) continue
      existing.add(part.toLowerCase())
      next.push(part)
    }
    onChange(next)
  }

  function commitDraft() {
    if (!draft.trim()) return
    add(draft)
    setDraft('')
  }

  const pending = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))

  return (
    <section id="campo-oferta" className="scroll-mt-20 border-t px-4 py-5">
      <h2 className="mb-1 font-semibold">¿Qué vende?</h2>
      <p className="text-muted-foreground mb-3 text-sm">
        Sin esto el negocio no aparece en las búsquedas. Dicta separando con comas.
      </p>

      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== item))}
                className="bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-full py-2 pr-2 pl-3 text-sm"
              >
                {item}
                <X className="size-4 opacity-60" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        value={draft}
        onChange={(e) => {
          // Al pegar o dictar, el separador ya viene dentro del texto.
          if (SEPARATORS.test(e.target.value)) {
            const parts = e.target.value.split(SEPARATORS)
            const tail = parts.pop() ?? ''
            add(parts.join(','))
            setDraft(tail)
            return
          }
          setDraft(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitDraft()
          }
        }}
        onBlur={() => {
          commitDraft()
          onBlur()
        }}
        placeholder="tacos, burritos, quesadillas…"
        autoCapitalize="off"
        autoCorrect="off"
        enterKeyHint="done"
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
      />

      {pending.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {pending.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => add(s)}
                className="border-input rounded-full border border-dashed px-3 py-2 text-sm"
              >
                + {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
