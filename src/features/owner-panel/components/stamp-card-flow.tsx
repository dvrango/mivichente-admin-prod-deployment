'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { addStamp, readStampCard, redeemStampCard } from '../actions'
import {
  cardTokenFromScan,
  errorCopy,
  errorScreenOf,
  rewardText,
  rewardTitle,
  screenAfterScan,
  unbreakableName,
  type ErrorScreen,
  type StampCardError,
  type StampCardState,
} from '../stamp-card'
import { ownerWhatsappLink } from '../whatsapp'
import { StampCardCamera } from './stamp-card-camera'
import styles from './stamp-card.module.css'

// Dar sello y canjear en caja (mockup v4, pantallas D1 a D7 y errores E1 a E8).
// Todas las reglas las decide la DB; esta pantalla solo pinta lo que responde.
//
// Doble toque: la DB ya impide dos sellos el mismo día y dos canjes de la misma
// vuelta. Lo que cuida `lock` es que el segundo toque no llegue a la DB, porque
// su respuesta (`already_stamped_today`, `already_redeemed`) taparía con un
// error el sello o el canje que sí entró.
//
// El token solo vive en el estado de este componente: no va en la URL.

type Screen =
  | { kind: 'inicio' }
  | { kind: 'camara' }
  | { kind: 'leyendo' }
  | { kind: 'leida'; token: string; card: StampCardState }
  | { kind: 'sellada'; token: string; card: StampCardState; before: number }
  | { kind: 'llena'; token: string; card: StampCardState }
  | { kind: 'confirmar'; token: string; card: StampCardState }
  | { kind: 'canjeada'; card: StampCardState }
  | {
      kind: 'error'
      screen: ErrorScreen
      businessName: string
      redeemedAt?: string | null
      retry?: () => void
    }

const REGALO = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </svg>
)

export function StampCardFlow({
  businessName,
  panelHref,
}: {
  /** El negocio elegido en el panel. E1 dice «no es de» este nombre. */
  businessName: string
  panelHref: string
}) {
  const [screen, setScreen] = useState<Screen>({ kind: 'inicio' })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  async function once(fn: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await fn()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function showError(
    s: ErrorScreen,
    extra: { retry?: () => void; redeemedAt?: string | null; name?: string } = {},
  ) {
    setScreen({
      kind: 'error',
      screen: s,
      businessName: extra.name ?? businessName,
      redeemedAt: extra.redeemedAt,
      retry: extra.retry,
    })
  }

  function showCard(token: string, card: StampCardState) {
    switch (screenAfterScan(card)) {
      case 'leida':
        return setScreen({ kind: 'leida', token, card })
      case 'llena':
        return setScreen({ kind: 'llena', token, card })
      case 'ya_sellada':
        return showError('ya_sellada', { name: card.businessName })
      case 'apagada':
        return showError('apagada', { name: card.businessName })
    }
  }

  /** Lee otra vez por token: tras una carrera, o para saber a qué hora se canjeó. */
  async function reread(token: string, then?: (card: StampCardState) => void): Promise<void> {
    let res
    try {
      res = await readStampCard(token)
    } catch {
      return showError('sin_conexion_lectura', { retry: () => void once(() => read(token)) })
    }
    if (!res.ok) return handleError(res.error, token)
    if (then) then(res.card)
    else showCard(token, res.card)
  }

  async function handleError(error: StampCardError, token: string, name?: string): Promise<void> {
    if (error === 'card_full' || error === 'card_not_full') return reread(token)
    if (error === 'already_redeemed') {
      return reread(token, (card) =>
        showError('ya_canjeado', { redeemedAt: card.lastRedeemedAt, name: card.businessName }),
      )
    }
    const s = errorScreenOf(error) ?? 'desconocido'
    showError(s, {
      name,
      retry: s === 'desconocido' ? () => void once(() => read(token)) : undefined,
    })
  }

  async function read(token: string): Promise<void> {
    setScreen({ kind: 'leyendo' })
    let res
    try {
      res = await readStampCard(token)
    } catch {
      return showError('sin_conexion_lectura', { retry: () => void once(() => read(token)) })
    }
    if (res.ok) showCard(token, res.card)
    else await handleError(res.error, token)
  }

  async function stamp(token: string, card: StampCardState): Promise<void> {
    let res
    try {
      res = await addStamp(token)
    } catch {
      return showError('sin_conexion_sello', {
        name: card.businessName,
        retry: () => void once(() => stamp(token, card)),
      })
    }
    if (res.ok) setScreen({ kind: 'sellada', token, card: res.card, before: card.stamps })
    else await handleError(res.error, token, card.businessName)
  }

  async function redeem(token: string, card: StampCardState): Promise<void> {
    if (!card.cardId) return reread(token)
    let res
    try {
      res = await redeemStampCard(card.cardId)
    } catch {
      return showError('sin_conexion_canje', {
        name: card.businessName,
        retry: () => void once(() => redeem(token, card)),
      })
    }
    if (res.ok) setScreen({ kind: 'canjeada', card: res.card })
    else await handleError(res.error, token, card.businessName)
  }

  function onScan(text: string) {
    const token = cardTokenFromScan(text)
    if (!token) return showError('no_es_tarjeta')
    void once(() => read(token))
  }

  const toCamera = () => setScreen({ kind: 'camara' })
  const toStart = () => setScreen({ kind: 'inicio' })

  if (screen.kind === 'camara') {
    return (
      <StampCardCamera
        onScan={onScan}
        onError={() => showError('camara', { retry: toCamera })}
        onCancel={toStart}
      />
    )
  }

  const name =
    'card' in screen
      ? screen.card.businessName
      : screen.kind === 'error'
        ? screen.businessName
        : businessName

  return (
    <div className={cn(styles.screen, 'font-sans')}>
      <div className={styles.head}>
        <span className="text-muted-foreground truncate text-sm font-semibold">
          {unbreakableName(name)} · Mi negocio
        </span>
      </div>
      <div className={styles.aviso} />
      <Body
        screen={screen}
        busy={busy}
        panelHref={panelHref}
        onCamera={toCamera}
        onStart={toStart}
        onStamp={(s) => void once(() => stamp(s.token, s.card))}
        onAskRedeem={(s) => setScreen({ kind: 'confirmar', token: s.token, card: s.card })}
        onRedeem={(s) => void once(() => redeem(s.token, s.card))}
        onBackToFull={(s) => setScreen({ kind: 'llena', token: s.token, card: s.card })}
      />
    </div>
  )
}

type WithCard = { token: string; card: StampCardState }

function Body({
  screen,
  busy,
  panelHref,
  onCamera,
  onStart,
  onStamp,
  onAskRedeem,
  onRedeem,
  onBackToFull,
}: {
  screen: Exclude<Screen, { kind: 'camara' }>
  busy: boolean
  panelHref: string
  onCamera: () => void
  onStart: () => void
  onStamp: (s: WithCard) => void
  onAskRedeem: (s: WithCard) => void
  onRedeem: (s: WithCard) => void
  onBackToFull: (s: WithCard) => void
}) {
  switch (screen.kind) {
    case 'inicio':
      return (
        <>
          <Message title="Tarjeta de sellos" />
          <Actions
            primary={{ label: 'Escanear tarjeta', onClick: onCamera }}
            secondary={{ label: 'Volver a mi negocio', href: panelHref }}
          />
        </>
      )
    case 'leyendo':
      return (
        <>
          <Message title="Leyendo la tarjeta…" />
          <Actions primary={{ label: 'Escanear tarjeta', onClick: onCamera, disabled: true }} />
        </>
      )
    case 'leida': {
      const c = screen.card
      return (
        <>
          <Message
            title={rewardTitle(c.reward)}
            line={`Lleva ${c.stamps} de ${c.stampsRequired}.`}
          />
          <Bar stamps={c.stamps} total={c.stampsRequired} />
          <Actions
            primary={{
              label: busy ? 'Dando sello…' : 'Dar sello',
              onClick: () => onStamp(screen),
              disabled: busy,
            }}
            secondary={{ label: 'Cancelar', onClick: onStart, disabled: busy }}
          />
        </>
      )
    }
    case 'sellada': {
      const c = screen.card
      return (
        <>
          <Message title="Sello dado" line={`Lleva ${c.stamps} de ${c.stampsRequired}.`} />
          <Bar stamps={c.stamps} total={c.stampsRequired} freshFrom={screen.before} />
          <Actions
            primary={
              c.isFull
                ? {
                    label: `Canjear ${rewardText(c.reward)}`,
                    onClick: () => onAskRedeem(screen),
                  }
                : { label: 'Escanear otra', onClick: onCamera }
            }
            secondary={{ label: 'Listo', onClick: onStart }}
          />
        </>
      )
    }
    case 'llena': {
      const c = screen.card
      return (
        <>
          <Message title="Tarjeta llena" />
          <Bar stamps={c.stamps} total={c.stampsRequired} />
          <Actions
            primary={{
              label: `Canjear ${rewardText(c.reward)}`,
              onClick: () => onAskRedeem(screen),
            }}
            secondary={{ label: 'Cancelar', onClick: onStart }}
          />
        </>
      )
    }
    case 'confirmar':
      return (
        <>
          <Message
            title={`¿Ya le entregaste su ${rewardText(screen.card.reward)}?`}
            line="No se puede deshacer."
          />
          <Actions
            primary={{
              label: busy ? 'Canjeando…' : 'Sí, ya se lo di',
              onClick: () => onRedeem(screen),
              disabled: busy,
            }}
            secondary={{ label: 'Todavía no', onClick: () => onBackToFull(screen), disabled: busy }}
          />
        </>
      )
    case 'canjeada': {
      const c = screen.card
      return (
        <>
          <Message title="Premio canjeado" line="Su tarjeta empieza otra vez." />
          <Bar stamps={c.stamps} total={c.stampsRequired} />
          <Actions
            primary={{ label: 'Escanear otra', onClick: onCamera }}
            secondary={{ label: 'Listo', onClick: onStart }}
          />
        </>
      )
    }
    case 'error': {
      const copy = errorCopy(screen.screen, {
        businessName: screen.businessName,
        redeemedAt: screen.redeemedAt,
      })
      const primary: Action = copy.whatsapp
        ? {
            label: copy.primary,
            href: ownerWhatsappLink(screen.businessName, 'cambio', 'Tarjeta de sellos'),
            external: true,
          }
        : {
            label: busy ? 'Intentando…' : copy.primary,
            onClick: copy.retries && screen.retry ? screen.retry : onCamera,
            disabled: busy,
          }
      return (
        <>
          <Message title={copy.title} line={copy.line} />
          <Actions
            primary={primary}
            secondary={{ label: 'Listo', onClick: onStart, disabled: busy }}
          />
        </>
      )
    }
  }
}

function Message({ title, line }: { title: string; line?: string }) {
  return (
    <div className={styles.msg} aria-live="polite">
      <h1 className="text-[26px] leading-[1.15] font-bold tracking-tight [overflow-wrap:anywhere]">
        {title}
      </h1>
      {line && <p className="text-muted-foreground mt-2 text-[15px] leading-snug">{line}</p>}
    </div>
  )
}

/** La barra por etapas. `freshFrom`: los tramos después de ese número se acaban de llenar (D4). */
function Bar({ stamps, total, freshFrom }: { stamps: number; total: number; freshFrom?: number }) {
  const on = Math.min(stamps, total)
  return (
    <div className={styles.prog}>
      <div className={styles.stamps}>
        <div
          className={styles.segs}
          style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
          role="img"
          aria-label={`${on} de ${total} sellos`}
        >
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1
            const fresh = freshFrom !== undefined && n > freshFrom && n <= on
            return (
              <div
                key={n}
                className={cn(styles.seg, n <= on && styles.segOn, fresh && styles.fresh)}
              />
            )
          })}
        </div>
        <div className={styles.sep} />
        <div className={cn(styles.gift, on >= total && styles.giftWon)}>{REGALO}</div>
      </div>
    </div>
  )
}

type Action = {
  label: string
  onClick?: () => void
  href?: string
  external?: boolean
  disabled?: boolean
}

const PRIMARY =
  'bg-primary text-primary-foreground flex items-center justify-center rounded-[10px] px-4 text-base font-semibold whitespace-nowrap disabled:opacity-60'
const SECONDARY =
  'text-foreground row-start-2 flex items-center justify-center text-[15px] font-medium disabled:opacity-50'

function ActionButton({ action, className }: { action: Action; className: string }) {
  if (action.href) {
    return action.external ? (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className={className}>
        {action.label}
      </a>
    ) : (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-busy={action.disabled || undefined}
      className={className}
    >
      {action.label}
    </button>
  )
}

function Actions({ primary, secondary }: { primary: Action; secondary?: Action }) {
  return (
    <div className={styles.act}>
      <ActionButton action={primary} className={cn(PRIMARY, 'row-start-1')} />
      {secondary && <ActionButton action={secondary} className={SECONDARY} />}
    </div>
  )
}
