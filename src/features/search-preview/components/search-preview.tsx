'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon-client'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Business } from '@/features/businesses/types'
import { getCompleteness, type CompletenessLevel } from '@/features/businesses/completeness'
import { normalizeText } from '@/lib/normalize'

type CategorySuggestion = {
  id: string
  name: string
  icon: string | null
  type: string
  aliases: string[]
  business_count: number
}

type Results = {
  businesses: Business[]
  suggestions: CategorySuggestion[]
}

// Mismos municipios que el selector de mobile (municipio.dart).
const MUNICIPIOS = ['Vicente Guerrero', 'Villa Unión', 'Nombre de Dios'] as const

// Offerings que matchean el query (pero no el nombre): explica por qué el
// negocio apareció, igual que la card de mobile.
function matchedOfferings(business: Business, query: string): string[] {
  const term = normalizeText(query)
  if (term.length < 2) return []
  if (normalizeText(business.name).includes(term)) return []
  return (business.offerings ?? []).filter((o) => normalizeText(o).includes(term))
}

const BORDER_BY_LEVEL: Record<CompletenessLevel, string> = {
  green: 'border-l-emerald-500',
  yellow: 'border-l-yellow-400',
  red: 'border-l-red-600',
}

// Espeja prioritizeByMunicipio de mobile: prioriza (no filtra) los negocios del
// municipio elegido; el resto conserva su orden relativo del RPC. Array.sort es
// estable en JS (ES2019+), igual que el List.sort de Dart.
function prioritizeByMunicipio(businesses: Business[], municipio: string): Business[] {
  if (!municipio) return businesses
  return [...businesses].sort((a, b) => {
    const aMatch = a.municipio === municipio
    const bMatch = b.municipio === municipio
    if (aMatch === bMatch) return 0
    return aMatch ? -1 : 1
  })
}

// Espeja la búsqueda de la app mobile: mismos RPC (search_businesses +
// suggest_categories), mismo orden que ve el usuario. Sirve para depurar por
// qué un negocio aparece o no ante un término dado (aliases, categoría, etc).
export function SearchPreview({ defaultMunicipio }: { defaultMunicipio?: string }) {
  // useMemo, no createAnonClient() a secas: a diferencia de createBrowserClient
  // (que cachea singleton), esto crea cliente nuevo cada llamada. Sin memo la
  // referencia cambia en cada render, useCallback `run` se recrea, el useEffect
  // de abajo se re-dispara en loop -> parpadeo constante.
  const supabase = useMemo(() => createAnonClient(), [])
  const [query, setQuery] = useState('')
  const [municipio, setMunicipio] = useState<string>(
    defaultMunicipio && (MUNICIPIOS as readonly string[]).includes(defaultMunicipio)
      ? defaultMunicipio
      : 'Vicente Guerrero',
  )
  const [rawResults, setRawResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Token monotónico: descarta respuestas de queries obsoletas (igual que el
  // SearchCubit de mobile).
  const tokenRef = useRef(0)

  // El fetch depende sólo del query. El municipio sólo reordena en cliente
  // (ver useMemo abajo), así que cambiarlo no dispara requests de red.
  const run = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      const token = ++tokenRef.current
      if (q.length < 2) {
        setRawResults(null)
        setError(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const [biz, sug] = await Promise.all([
        supabase.rpc('search_businesses', { search_query: q }),
        supabase.rpc('suggest_categories', { search_query: q }),
      ])
      if (token !== tokenRef.current) return // respuesta obsoleta
      if (biz.error || sug.error) {
        setError(biz.error?.message ?? sug.error?.message ?? 'Error al buscar')
        setRawResults(null)
      } else {
        setRawResults({ businesses: biz.data ?? [], suggestions: sug.data ?? [] })
      }
      setLoading(false)
    },
    [supabase],
  )

  // Debounce 300ms, igual que mobile.
  useEffect(() => {
    const id = setTimeout(() => run(query), 300)
    return () => clearTimeout(id)
  }, [query, run])

  // Prioridad por municipio: derivación en memoria, no vuelve a pegar a la red.
  const results = useMemo<Results | null>(() => {
    if (!rawResults) return null
    return {
      businesses: prioritizeByMunicipio(rawResults.businesses, municipio),
      suggestions: rawResults.suggestions,
    }
  }, [rawResults, municipio])

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Control de debug: no es parte de la UI de mobile, va afuera del phone. */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0 text-sm">Municipio:</span>
        <Select value={municipio} onValueChange={(v) => setMunicipio(v ?? '')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MUNICIPIOS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leyenda de completitud del perfil */}
      <div className="text-muted-foreground flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" /> Completo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-yellow-400" /> A medias
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-600" /> Casi vacío
        </span>
      </div>

      {/* Mockup de teléfono */}
      <div className="rounded-[2.5rem] border-8 border-neutral-800 bg-neutral-800 shadow-xl">
        <div className="relative flex h-[720px] w-[360px] flex-col overflow-hidden rounded-[2rem] bg-white">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 z-10 h-5 w-32 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />

          {/* Search bar */}
          <div className="border-b px-4 pt-8 pb-3">
            <Input
              autoFocus
              placeholder="Tacos, barbería, ferretería…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && <p className="text-destructive text-sm">{error}</p>}

            {loading && <p className="text-muted-foreground text-sm">Buscando…</p>}

            {!loading && !error && !results && (
              <p className="text-muted-foreground pt-16 text-center text-sm">
                Escribe para buscar negocios locales
              </p>
            )}

            {!loading && results && (
              <div className="space-y-5">
                {results.suggestions.length === 0 && results.businesses.length === 0 && (
                  <p className="text-muted-foreground pt-16 text-center text-sm">
                    Sin resultados para &ldquo;{query.trim()}&rdquo;.
                  </p>
                )}

                {results.suggestions.length > 0 && (
                  <ul className="divide-border divide-y rounded-md border">
                    {results.suggestions.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/categories/${s.id}`}
                          className="hover:bg-accent flex items-center gap-3 px-3 py-2 text-sm transition-colors"
                        >
                          <span className="text-lg">{s.icon ?? '🏪'}</span>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">
                            · ver {s.business_count}{' '}
                            {s.business_count === 1 ? 'negocio' : 'negocios'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {results.businesses.length > 0 && (
                  <section className="space-y-2">
                    <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Negocios ({results.businesses.length})
                    </h2>
                    <ol className="divide-border divide-y rounded-md border">
                      {results.businesses.map((b, i) => {
                        const c = getCompleteness(b)
                        const offers = matchedOfferings(b, query)
                        return (
                          <li key={b.id}>
                            <Link
                              href={`/businesses/${b.id}`}
                              title={
                                c.missing.length
                                  ? `Falta: ${c.missing.join(', ')}`
                                  : 'Perfil completo'
                              }
                              className={`hover:bg-accent flex flex-col gap-1 border-l-4 px-3 py-2 text-sm transition-colors ${BORDER_BY_LEVEL[c.level]}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-5 shrink-0 tabular-nums">
                                  {i + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {b.name}
                                </span>
                                {b.is_featured && <Badge variant="secondary">Destacado</Badge>}
                                {b.is_verified && <Badge variant="outline">Verificado</Badge>}
                              </div>
                              {offers.length > 0 && (
                                <p className="text-muted-foreground pl-7 text-xs">
                                  Ofrece{' '}
                                  {offers.map((o, j) => (
                                    <span key={o}>
                                      <span className="text-foreground font-semibold">{o}</span>
                                      {j < offers.length - 1 && ', '}
                                    </span>
                                  ))}
                                </p>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
