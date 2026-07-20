'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCompleteness } from '@/features/businesses/completeness'
import type { Business } from '@/features/businesses/types'
import { FIELD_SEARCH_DEBOUNCE_MS } from '../constants'

type Result = Business & { category: { id: string; name: string; type: string } | null }

const DOT_BY_LEVEL = {
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
} as const

export function FieldSearch({
  municipio,
  isAdmin,
}: {
  municipio: string | null
  isAdmin: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  // El cliente AUTENTICADO, no `createAnonClient()`. Con anon aplica la policy
  // pública (sólo is_active = true) y desaparecerían justo los negocios que se
  // vienen a completar: los scrapeados, que están inactivos.
  const supabase = useMemo(() => createClient(), [])
  const tokenRef = useRef(0)

  const run = useCallback(
    async (raw: string) => {
      const term = raw.trim()
      const token = ++tokenRef.current
      if (term.length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      const { data } = await supabase
        .rpc('search_businesses', { search_query: term })
        .select('*, category:categories!businesses_category_id_fkey(id, name, type)')

      // Descartar respuestas viejas que llegaron fuera de orden.
      if (tokenRef.current !== token) return
      setResults((data as Result[] | null) ?? [])
      setLoading(false)
    },
    [supabase],
  )

  useEffect(() => {
    const timer = setTimeout(() => void run(query), FIELD_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, run])

  const canEdit = (b: Result) => isAdmin || b.municipio === municipio

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="bg-background sticky top-0 z-10 border-b px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/businesses"
            className="text-muted-foreground hover:text-foreground -ml-1 flex size-9 items-center justify-center rounded-lg"
            aria-label="Salir del modo campo"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold">Captura en campo</h1>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
          {/* text-base (16px) es obligatorio: con menos, iOS hace zoom al enfocar. */}
          <input
            type="search"
            inputMode="search"
            autoFocus
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre del negocio…"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border pr-4 pl-11 text-base outline-none focus-visible:ring-3"
          />
          {loading && (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin" />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        <ul className="divide-y">
          {results.map((b) => {
            const { level, missing } = getCompleteness(b)
            const editable = canEdit(b)

            const inner = (
              <>
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT_BY_LEVEL[level]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {b.category?.name ?? 'Sin categoría'} · {b.municipio}
                  </span>
                  {missing.length > 0 && (
                    <span className="mt-0.5 block truncate text-xs text-amber-700 dark:text-amber-500">
                      Falta: {missing.join(' · ')}
                    </span>
                  )}
                  {!editable && (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      Otro municipio — no puedes editarlo
                    </span>
                  )}
                </span>
              </>
            )

            return (
              <li key={b.id}>
                {editable ? (
                  <Link
                    href={`/campo/${b.id}`}
                    className="active:bg-muted flex min-h-16 items-start gap-3 py-3"
                  >
                    {inner}
                  </Link>
                ) : (
                  // Se muestra pero no se abre: `businesses_select` deja leer todo,
                  // `businesses_update` no. Mejor verlo aquí que al guardar.
                  <div className="flex min-h-16 items-start gap-3 py-3 opacity-50">{inner}</div>
                )}
              </li>
            )
          })}
        </ul>

        {query.trim().length >= 2 && !loading && (
          <Link
            href={`/campo/nuevo?name=${encodeURIComponent(query.trim())}`}
            className="border-primary/40 text-primary active:bg-primary/5 mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl border border-dashed px-4 font-medium"
          >
            <Plus className="size-5" />
            No está — crear &ldquo;{query.trim()}&rdquo;
          </Link>
        )}

        {query.trim().length < 2 && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Busca el negocio antes de crearlo.
            <br />
            Casi todos ya están cargados.
          </p>
        )}
      </div>
    </div>
  )
}
