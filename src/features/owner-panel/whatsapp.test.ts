import { describe, expect, it } from 'vitest'
import { ownerWhatsappLink, ownerWhatsappMessage } from './whatsapp'

describe('WhatsApp del panel del dueño', () => {
  it('va al número de Vichente con el 52 de México', () => {
    expect(ownerWhatsappLink('K-fféss', 'cambio')).toMatch(/^https:\/\/wa\.me\/526751108948\?text=/)
  })

  it('cada mensaje lleva el nombre del negocio', () => {
    for (const topic of ['cambio', 'opiniones', 'actividad'] as const) {
      expect(ownerWhatsappMessage('  K-fféss ', topic)).toContain('soy de K-fféss.')
    }
  })

  it('el mensaje dice de qué sección sale', () => {
    expect(ownerWhatsappMessage('X', 'opiniones')).toContain('Me interesa: opiniones')
    expect(ownerWhatsappMessage('X', 'actividad')).toContain('Me interesa: saber cuánta gente')
    expect(ownerWhatsappMessage('X', 'cambio')).toContain('Quiero cambiar algo')
  })

  it('codifica el texto para la URL', () => {
    const url = new URL(ownerWhatsappLink('Café & Pan', 'opiniones'))
    expect(url.searchParams.get('text')).toBe(ownerWhatsappMessage('Café & Pan', 'opiniones'))
  })
})
