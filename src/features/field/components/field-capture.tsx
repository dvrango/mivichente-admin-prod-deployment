'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
import { formatMxPhone, normalizeMxPhone } from '@/lib/validation/phone'
import type { Business, CategoryOption } from '@/features/businesses/types'
import { finishFieldVisit, getOfferingSuggestions, setFieldPrimaryCategory } from '../actions'
import { useFieldSave } from '../hooks/use-field-save'
import { seedOfferings } from '../offering-suggestions'
import type { FieldPhoto } from '../queries'
import { FieldLocation } from './field-location'
import { FieldOfferings } from './field-offerings'
import { FieldPhotos } from './field-photos'

// Requisitos para dar una visita por terminada. Es una lista MÁS CORTA que los 8
// campos de `getCompleteness`: ese score incluye Horario y Redes, que no son
// obligatorios para publicar. El anillo mide calidad de ficha; esto mide "ya
// puedo irme del negocio".
type Requirement = { id: string; label: string; done: boolean }

export function FieldCapture({
  business,
  photos,
  categories,
  primaryCategoryId,
}: {
  business: Business
  photos: FieldPhoto[]
  categories: CategoryOption[]
  primaryCategoryId: string | null
}) {
  const router = useRouter()
  const { overall, save, saveNow, flush } = useFieldSave(business.id)

  const [name, setName] = useState(business.name)
  const [phone, setPhone] = useState(business.phone ?? '')
  const [isWhatsapp, setIsWhatsapp] = useState(business.phone_is_whatsapp)
  const [address, setAddress] = useState(business.address ?? '')
  const [mapsUrl, setMapsUrl] = useState(business.maps_url ?? '')
  const [description, setDescription] = useState(business.description ?? '')
  const [offerings, setOfferings] = useState<string[]>(business.offerings ?? [])
  const [categoryId, setCategoryId] = useState(primaryCategoryId)
  const [photoCount, setPhotoCount] = useState(photos.length)

  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dbSuggestions, setDbSuggestions] = useState<string[]>([])
  const [finishing, startFinish] = useTransition()
  const [finishError, setFinishError] = useState<string | null>(null)

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  )

  // Sugerencias de oferta: primero las que ya usan otros negocios de la misma
  // categoría, rellenando con la semilla hasta 12. La semilla es lo que las hace
  // útiles hoy — casi ningún negocio scrapeado tiene offerings todavía.
  useEffect(() => {
    let active = true
    void (async () => {
      const next = categoryId ? await getOfferingSuggestions(categoryId) : []
      if (active) setDbSuggestions(next)
    })()
    return () => {
      active = false
    }
  }, [categoryId])

  const suggestions = useMemo(() => {
    const seed = seedOfferings(category?.name ?? null, category?.type ?? null)
    const merged = [...dbSuggestions]
    for (const s of seed) {
      if (merged.length >= 12) break
      if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) merged.push(s)
    }
    return merged
  }, [dbSuggestions, category])

  const requirements: Requirement[] = [
    { id: 'campo-fotos', label: 'Foto', done: photoCount > 0 },
    { id: 'campo-telefono', label: 'Teléfono', done: normalizeMxPhone(phone).length === 10 },
    { id: 'campo-categoria', label: 'Categoría', done: !!categoryId },
    { id: 'campo-oferta', label: 'Oferta', done: offerings.length > 0 },
    {
      id: 'campo-ubicacion',
      label: 'Ubicación',
      done: !!address.trim() || !!mapsUrl.trim(),
    },
    { id: 'campo-nombre', label: 'Nombre', done: !!name.trim() },
  ]
  const missing = requirements.filter((r) => !r.done)
  const score = (requirements.length - missing.length) / requirements.length

  // Tocar un chip lleva al campo. Es todo el modelo de navegación: no se scrollea
  // buscando qué falta, la app lo dice y te lleva.
  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true })
  }, [])

  async function pickCategory(id: string) {
    setCategoryId(id)
    setCategoryOpen(false)
    setCategoryFilter('')
    await setFieldPrimaryCategory(business.id, id)
  }

  function finish() {
    setFinishError(null)
    startFinish(async () => {
      const result = await finishFieldVisit(business.id)
      if (result.error) {
        setFinishError(result.error)
        return
      }
      router.push('/campo')
    })
  }

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categoryFilter.toLowerCase()),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="bg-background sticky top-0 z-10 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href="/campo"
            className="text-muted-foreground hover:text-foreground -ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg"
            aria-label="Volver a la búsqueda"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <CompletenessRing score={score} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {name || 'Sin nombre'}
          </span>
          <SavePill status={overall} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
        {/* Las fotos van primero a propósito: son lo único que no se puede
            conseguir después por teléfono. */}
        <FieldPhotos
          businessId={business.id}
          initialPhotos={photos}
          onCountChange={setPhotoCount}
        />

        <section id="campo-nombre" className="scroll-mt-20 border-t px-4 py-5">
          <h2 className="mb-3 font-semibold">Nombre</h2>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              save('name', e.target.value)
            }}
            onBlur={() => flush('name')}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
          />
        </section>

        <section id="campo-telefono" className="scroll-mt-20 border-t px-4 py-5">
          <h2 className="mb-3 font-semibold">Teléfono</h2>
          <input
            type="tel"
            inputMode="tel"
            value={formatMxPhone(phone)}
            onChange={(e) => {
              const digits = normalizeMxPhone(e.target.value)
              setPhone(digits)
              if (digits.length === 10) save('phone', digits)
            }}
            onBlur={() => flush('phone')}
            placeholder="618 123 4567"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
          />
          <button
            type="button"
            onClick={() => {
              const next = !isWhatsapp
              setIsWhatsapp(next)
              save('phone_is_whatsapp', next)
              void flush('phone_is_whatsapp')
            }}
            className="mt-3 flex min-h-12 w-full items-center gap-3 text-left"
          >
            <span
              className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                isWhatsapp ? 'bg-emerald-500' : 'bg-muted'
              }`}
            >
              <span
                className={`size-5 rounded-full bg-white transition-transform ${
                  isWhatsapp ? 'translate-x-5' : ''
                }`}
              />
            </span>
            Tiene WhatsApp
          </button>
        </section>

        <section id="campo-categoria" className="scroll-mt-20 border-t px-4 py-5">
          <h2 className="mb-3 font-semibold">Categoría</h2>
          <button
            type="button"
            onClick={() => setCategoryOpen((v) => !v)}
            className="border-input flex h-14 w-full items-center justify-between rounded-xl border px-4 text-base"
          >
            <span className={category ? '' : 'text-muted-foreground'}>
              {category?.name ?? 'Elegir categoría'}
            </span>
            <ChevronDown
              className={`size-5 transition-transform ${categoryOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {categoryOpen && (
            <div className="mt-3">
              <input
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="Buscar categoría…"
                className="border-input bg-background mb-2 h-12 w-full rounded-xl border px-4 text-base outline-none"
              />
              <ul className="max-h-72 overflow-y-auto rounded-xl border">
                {filteredCategories.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickCategory(c.id)}
                      className="active:bg-muted flex min-h-12 w-full items-center justify-between px-4 text-left text-base"
                    >
                      {c.name}
                      {c.id === categoryId && <Check className="size-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <FieldOfferings
          value={offerings}
          suggestions={suggestions}
          onChange={(next) => {
            setOfferings(next)
            save('offerings', next)
          }}
          onBlur={() => flush('offerings')}
        />

        <FieldLocation
          address={address}
          mapsUrl={mapsUrl}
          savedAccuracy={business.location_accuracy_m}
          onAddressChange={(value) => {
            setAddress(value)
            save('address', value)
          }}
          onAddressBlur={() => flush('address')}
          onLocation={(location) => {
            setMapsUrl(location.mapsUrl)
            // Los cuatro campos van en una sola escritura: nunca debe quedar
            // maps_url sin coordenadas ni al revés.
            void saveNow({
              maps_url: location.mapsUrl,
              latitude: location.latitude,
              longitude: location.longitude,
              location_accuracy_m: location.accuracy,
            })
          }}
        />

        <section className="border-t px-4 py-5">
          <h2 className="mb-3 font-semibold">Descripción</h2>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              save('description', e.target.value)
            }}
            onBlur={() => flush('description')}
            rows={3}
            placeholder="Qué lo hace distinto, desde cuándo existe…"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-xl border p-4 text-base outline-none focus-visible:ring-3"
          />
        </section>
      </div>

      <div className="bg-background sticky bottom-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {finishError && <p className="text-destructive mb-2 px-1 text-sm">{finishError}</p>}
        {missing.length > 0 && (
          <ul className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {missing.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => goTo(r.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <TriangleAlert className="size-3.5" />
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={finish}
          disabled={missing.length > 0 || finishing}
          className="bg-primary text-primary-foreground h-14 w-full rounded-xl text-base font-medium active:translate-y-px disabled:opacity-40"
        >
          {finishing ? 'Guardando…' : business.is_active ? 'Listo' : 'Terminar visita'}
        </button>
      </div>
    </div>
  )
}

function CompletenessRing({ score }: { score: number }) {
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const color = score === 1 ? 'text-emerald-500' : score >= 0.5 ? 'text-yellow-500' : 'text-red-500'

  return (
    <svg viewBox="0 0 24 24" className={`size-6 shrink-0 -rotate-90 ${color}`} aria-hidden>
      <circle cx="12" cy="12" r={radius} className="stroke-muted" strokeWidth="3" fill="none" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score)}
      />
    </svg>
  )
}

function SavePill({ status }: { status: ReturnType<typeof useFieldSave>['overall'] }) {
  if (status === 'idle') return null
  if (status === 'saving' || status === 'dirty') {
    return (
      <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
        <Loader2 className="size-3 animate-spin" />
        Guardando
      </span>
    )
  }
  if (status === 'error') {
    return <span className="text-destructive shrink-0 text-xs">Error al guardar</span>
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
      <Check className="size-3" />
      Guardado
    </span>
  )
}
