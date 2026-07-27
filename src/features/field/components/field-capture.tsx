'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Share2,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { formatMxPhone, normalizeMxPhone } from '@/lib/validation/phone'
import type { Business, CategoryOption, WeeklyHours } from '@/features/businesses/types'
import {
  finishFieldVisit,
  getOfferingSuggestions,
  setFieldHours,
  setFieldPrimaryCategory,
} from '../actions'
import { useFieldSave } from '../hooks/use-field-save'
import { seedOfferings } from '../offering-suggestions'
import type { FieldPhoto } from '../queries'
import { FieldHours } from './field-hours'
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
  hours: initialHours,
}: {
  business: Business
  photos: FieldPhoto[]
  categories: CategoryOption[]
  primaryCategoryId: string | null
  hours: WeeklyHours
}) {
  const router = useRouter()
  const { overall, save, saveNow, flush, flushAll } = useFieldSave(business.id)

  const [name, setName] = useState(business.name)
  const [phone, setPhone] = useState(business.phone ?? '')
  const [isWhatsapp, setIsWhatsapp] = useState(business.phone_is_whatsapp)
  const [address, setAddress] = useState(business.address ?? '')
  const [mapsUrl, setMapsUrl] = useState(business.maps_url ?? '')
  const [description, setDescription] = useState(business.description ?? '')
  const [offerings, setOfferings] = useState<string[]>(business.offerings ?? [])
  const [categoryId, setCategoryId] = useState(primaryCategoryId)
  const [photoCount, setPhotoCount] = useState(photos.length)
  const [hours, setHours] = useState<WeeklyHours>(initialHours)
  const [schedule, setSchedule] = useState(business.schedule ?? '')
  const [owner, setOwner] = useState(business.owner ?? '')
  const [ownerPhone, setOwnerPhone] = useState(business.owner_phone ?? '')
  const [ownerNote, setOwnerNote] = useState(business.owner_contact_note ?? '')

  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dbSuggestions, setDbSuggestions] = useState<string[]>([])
  const [finishing, startFinish] = useTransition()
  const [finishError, setFinishError] = useState<string | null>(null)
  // Al terminar, en vez de saltar directo a /campo, mostramos la ficha lista
  // para compartir: ese es el paso que convierte la visita en usuarios (el dueño
  // manda su link a sus clientes). Sin esto la captura no cierra conversión.
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `https://vichente.com/${business.slug}`
  const shareUrlDisplay = `vichente.com/${business.slug}`

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
    // El horario se olvidaba porque el form no lo pedía. Cuenta como cubierto
    // también con el texto libre: "previa cita" en un psicólogo o "hasta que se
    // acaba la carne" en unas carnitas no es un dato faltante, ES el horario.
    {
      id: 'campo-horario',
      label: 'Horario',
      done: Object.keys(hours).length > 0 || !!schedule.trim(),
    },
  ]
  const missing = requirements.filter((r) => !r.done)
  const score = (requirements.length - missing.length) / requirements.length

  // El gate sólo aplica al PUBLICAR: evita que salga al directorio una ficha
  // vacía. En un negocio ya publicado el botón es una salida, no un cierre de
  // visita — todo se guardó solo mientras se capturaba, así que bloquearlo no
  // protege nada y sólo estorba. Los chips de lo que falta se siguen viendo.
  const blockedByRequirements = !business.is_active && missing.length > 0

  // Tocar un chip lleva al campo. Es todo el modelo de navegación: no se scrollea
  // buscando qué falta, la app lo dice y te lleva.
  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true })
  }, [])

  function saveHours(next: WeeklyHours) {
    setHours(next)
    void (async () => {
      const result = await setFieldHours(business.id, next)
      if (result.error) setFinishError(result.error)
    })()
  }

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
      setDone(true)
    })
  }

  async function shareCard() {
    // Web Share API: en el celular abre el sheet nativo con WhatsApp arriba —
    // que es el canal real del pueblo. Sin soporte, cae a copiar.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, text: `${name} en Vichente`, url: shareUrl })
      } catch {
        // El usuario canceló el sheet: no es error.
      }
      return
    }
    await copyLink()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFinishError('No se pudo copiar el link')
    }
  }

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categoryFilter.toLowerCase()),
  )

  if (done) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <Check className="size-8" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{name} ya está en Vichente</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Pásale su ficha al dueño para que la comparta con sus clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="bg-muted/40 flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm">{shareUrlDisplay}</span>
          {copied ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
              <Check className="size-4" />
              Copiado
            </span>
          ) : (
            <Copy className="text-muted-foreground size-4 shrink-0" />
          )}
        </button>

        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={shareCard}
            className="bg-primary text-primary-foreground flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-medium active:translate-y-px"
          >
            <Share2 className="size-5" />
            Compartir ficha
          </button>
          <button
            type="button"
            onClick={() => router.push('/campo')}
            className="text-muted-foreground hover:text-foreground h-12 w-full text-base font-medium"
          >
            Siguiente negocio
          </button>
        </div>
      </div>
    )
  }

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
          {/* Salida al editor de escritorio, con el mismo negocio ya abierto.
              `returnTo` regresa aquí al guardar: campo y editor dejan de ser
              islas separadas. */}
          <Link
            href={`/businesses/${business.id}?returnTo=/campo/${business.id}`}
            onClick={flushAll}
            aria-label="Abrir en el editor completo"
            className="text-muted-foreground hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
          >
            <SlidersHorizontal className="size-5" />
          </Link>
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

        <FieldHours
          value={hours}
          scheduleText={schedule}
          onHoursChange={saveHours}
          onScheduleChange={(text) => {
            setSchedule(text)
            save('schedule', text)
          }}
          onScheduleBlur={() => flush('schedule')}
        />

        <section id="campo-dueno" className="scroll-mt-20 border-t px-4 py-5">
          <h2 className="font-semibold">Contacto del dueño</h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            A quién le hablas después por las fotos o para que reclame su ficha. No sale en la app.
          </p>
          <input
            value={owner}
            onChange={(e) => {
              setOwner(e.target.value)
              save('owner', e.target.value)
            }}
            onBlur={() => flush('owner')}
            placeholder="Nombre del dueño"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mb-3 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
          />
          <input
            type="tel"
            inputMode="tel"
            value={formatMxPhone(ownerPhone)}
            onChange={(e) => {
              const digits = normalizeMxPhone(e.target.value)
              setOwnerPhone(digits)
              if (digits.length === 0 || digits.length === 10) save('owner_phone', digits)
            }}
            onBlur={() => flush('owner_phone')}
            placeholder="Su teléfono"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mb-3 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
          />
          <input
            value={ownerNote}
            onChange={(e) => {
              setOwnerNote(e.target.value)
              save('owner_contact_note', e.target.value)
            }}
            onBlur={() => flush('owner_contact_note')}
            placeholder="Quién es (ej. hija del dueño, lleva el FB)"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-3"
          />
        </section>

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
          disabled={blockedByRequirements || finishing}
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
