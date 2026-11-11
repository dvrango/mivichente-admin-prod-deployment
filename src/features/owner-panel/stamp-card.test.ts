import { describe, expect, it } from 'vitest'
import { addStampSchema } from './schema'
import {
  cardTokenFromScan,
  errorCopy,
  errorScreenOf,
  redeemedLine,
  rewardTitle,
  screenAfterScan,
  sameStampRound,
  showsStampCardEntry,
  stampCardErrorOf,
  type StampCardState,
} from './stamp-card'

const TOKEN = 'Ab3_-xYz0123456789abcdEF'

const base: StampCardState = {
  cardId: '00000000-0000-0000-0000-000000000001',
  businessId: '00000000-0000-0000-0000-000000000002',
  businessName: 'K-fféss',
  programActive: true,
  reward: 'frappé gratis',
  stampsRequired: 8,
  stamps: 5,
  isFull: false,
  stampedToday: false,
  dailyLimitApplies: true,
  lastRedeemedAt: null,
}

describe('token de la tarjeta desde el QR', () => {
  it('lee la URL de la digital y de la física', () => {
    expect(cardTokenFromScan(`https://vichente.com/t/${TOKEN}`)).toBe(TOKEN)
    expect(cardTokenFromScan(`https://www.vichente.com/t/${TOKEN}/`)).toBe(TOKEN)
    expect(cardTokenFromScan(`  https://vichente.com/t/${TOKEN}?src=x  `)).toBe(TOKEN)
  })

  it('el QR del mostrador y el del menú no son tarjetas', () => {
    expect(cardTokenFromScan('https://vichente.com/k-ffess/tarjeta?src=tarjeta-qr')).toBeNull()
    expect(cardTokenFromScan('https://vichente.com/k-ffess/menu')).toBeNull()
    expect(cardTokenFromScan('https://vichente.com/k-ffess')).toBeNull()
  })

  it('rechaza otros dominios, http, texto suelto y tokens raros', () => {
    expect(cardTokenFromScan(`https://vichente.com.mx/t/${TOKEN}`)).toBeNull()
    expect(cardTokenFromScan(`https://evil.com/t/${TOKEN}`)).toBeNull()
    expect(cardTokenFromScan(`http://vichente.com/t/${TOKEN}`)).toBeNull()
    expect(cardTokenFromScan(TOKEN)).toBeNull()
    expect(cardTokenFromScan('https://vichente.com/t/abc')).toBeNull()
    expect(cardTokenFromScan(`https://vichente.com/t/${TOKEN}/extra`)).toBeNull()
    expect(cardTokenFromScan('https://vichente.com/t/%E0%A4%A')).toBeNull()
  })
})

describe('entrada en el panel', () => {
  it('sale con el programa prendido en un negocio activo', () => {
    expect(showsStampCardEntry({ is_active: true, stamp_card_active: true })).toBe(true)
    expect(showsStampCardEntry({ is_active: false, stamp_card_active: true })).toBe(false)
  })

  it('apagado, solo mientras quede un premio por entregar', () => {
    const apagado = { is_active: true, stamp_card_active: false }
    expect(showsStampCardEntry({ ...apagado, stamp_card_pending_rewards: 0 })).toBe(false)
    expect(showsStampCardEntry({ ...apagado, stamp_card_pending_rewards: 2 })).toBe(true)
  })

  it('un snapshot sin las llaves no la enseña', () => {
    expect(showsStampCardEntry({ is_active: true })).toBe(false)
  })
})

describe('pantalla después de leer', () => {
  it('a medias y sin sello de hoy: D3', () => {
    expect(screenAfterScan(base)).toBe('leida')
  })

  it('llena: D5, aunque el programa esté apagado', () => {
    expect(screenAfterScan({ ...base, stamps: 8, isFull: true })).toBe('llena')
    expect(screenAfterScan({ ...base, stamps: 8, isFull: true, programActive: false })).toBe(
      'llena',
    )
  })

  it('programa apagado sin llenar: E8', () => {
    expect(screenAfterScan({ ...base, programActive: false })).toBe('apagada')
  })

  it('ya recibió el sello de hoy: E4', () => {
    expect(screenAfterScan({ ...base, stampedToday: true })).toBe('ya_sellada')
  })

  it('el demo permite seguir sellando después del primer sello de hoy', () => {
    expect(screenAfterScan({ ...base, stampedToday: true, dailyLimitApplies: false })).toBe('leida')
    expect(
      screenAfterScan({ ...base, stampedToday: true, dailyLimitApplies: false, isFull: true }),
    ).toBe('llena')
    expect(screenAfterScan({ ...base, dailyLimitApplies: false, programActive: false })).toBe(
      'apagada',
    )
  })
})

describe('intento de sello', () => {
  it('no anima un sello en otra vuelta tras perder la respuesta', () => {
    expect(sameStampRound(base, { ...base, stamps: 6 })).toBe(true)
    expect(sameStampRound(base, { ...base, cardId: 'otra-vuelta', stamps: 0 })).toBe(false)
  })

  it('detecta un canje concurrente aunque la lectura no tuviera vuelta abierta', () => {
    const before = { ...base, cardId: null, stamps: 0, lastRedeemedAt: '2026-11-10T20:00:00Z' }
    expect(
      sameStampRound(before, { ...base, stamps: 1, lastRedeemedAt: before.lastRedeemedAt }),
    ).toBe(true)
    expect(
      sameStampRound(before, { ...base, stamps: 0, lastRedeemedAt: '2026-11-11T20:00:00Z' }),
    ).toBe(false)
  })

  it('exige un UUID y un token válidos antes de invocar la RPC', () => {
    expect(addStampSchema.safeParse({ token: TOKEN }).success).toBe(false)
    expect(addStampSchema.safeParse({ token: TOKEN, operationId: 'otro' }).success).toBe(false)
    expect(
      addStampSchema.safeParse({
        token: TOKEN,
        operationId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
  })

  it('una respuesta perdida no afirma que el sello no entró', () => {
    const copy = errorCopy('sin_conexion_sello', { businessName: base.businessName })
    expect(copy.title).toBe('No se pudo confirmar el sello')
    expect(copy.retries).toBe(true)
  })
})

describe('errores de la DB', () => {
  it('reconoce solo los mensajes de la tarjeta', () => {
    expect(stampCardErrorOf('not_your_business')).toBe('not_your_business')
    expect(stampCardErrorOf('card_not_linked')).toBe('card_not_linked')
    expect(stampCardErrorOf('permission denied for function')).toBe('unknown')
    expect(stampCardErrorOf(undefined)).toBe('unknown')
  })

  it('cada error lleva su pantalla, y las carreras no llevan ninguna', () => {
    expect(errorScreenOf('not_your_business')).toBe('otro_negocio')
    expect(errorScreenOf('not_a_card')).toBe('no_es_tarjeta')
    expect(errorScreenOf('card_not_linked')).toBe('no_activada')
    expect(errorScreenOf('already_redeemed')).toBe('ya_canjeado')
    expect(errorScreenOf('already_stamped_today')).toBe('ya_sellada')
    expect(errorScreenOf('stamp_card_not_available')).toBe('apagada')
    expect(errorScreenOf('card_full')).toBeNull()
    expect(errorScreenOf('card_not_full')).toBeNull()
  })

  it('E1 dice el negocio del dueño y no el de la tarjeta', () => {
    expect(errorCopy('otro_negocio', { businessName: 'K-fféss' }).title).toBe(
      'Esta tarjeta no es de K‑fféss',
    )
  })

  it('E8 manda a WhatsApp', () => {
    const e8 = errorCopy('apagada', { businessName: 'K-fféss' })
    expect(e8.title).toBe('Tu tarjeta de sellos está apagada')
    expect(e8.whatsapp).toBe(true)
  })
})

describe('textos', () => {
  it('título del premio', () => {
    expect(rewardTitle('frappé gratis')).toBe('Frappé gratis')
    expect(rewardTitle(null)).toBe('Premio')
  })

  it('hora del canje en hora de Durango', () => {
    const now = new Date('2026-11-06T22:00:00Z') // 16:00 en Durango
    expect(redeemedLine('2026-11-06T19:42:00Z', now)).toBe('Se entregó hoy a las 13:42.')
    expect(redeemedLine('2026-11-05T19:42:00Z', now)).toMatch(/^Se entregó el 5 nov a las 13:42\.$/)
    expect(redeemedLine(null, now)).toBe('Ya se entregó antes.')
  })
})
