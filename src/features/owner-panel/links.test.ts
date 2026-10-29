import { describe, expect, it } from 'vitest'
import { ownerLinks, ownerMenuUrl } from './links'

const publicado = { slug: 'mr-xilaquil', is_active: true }
const opts = { hasServices: true }

describe('links del panel del dueño', () => {
  it('sin publicar o sin slug no da links', () => {
    expect(ownerLinks({ slug: 'mr-xilaquil', is_active: false }, opts)).toEqual([])
    expect(ownerLinks({ slug: null, is_active: true }, opts)).toEqual([])
  })

  it('el link para pedir va primero y destacado', () => {
    const [primero] = ownerLinks(publicado, opts)
    expect(primero.key).toBe('ordenar')
    expect(primero.featured).toBe(true)
  })

  it('con pedidos activados promete que ahí le piden', () => {
    const [primero] = ownerLinks(publicado, { hasServices: true, acceptsOrders: true })
    expect(primero.title).toBe('Tu link para que te pidan')
    expect(primero.purpose).toContain('arma su pedido')
    expect(primero.purpose).not.toContain('Si tienes')
  })

  it('sin pedidos activados no promete que le pidan', () => {
    const [primero] = ownerLinks(publicado, { hasServices: true, acceptsOrders: false })
    expect(primero.title).not.toContain('pidan')
    expect(primero.purpose).not.toContain('arma su pedido')
    expect(primero.featured).toBe(true)
  })

  it('sin saber si tiene pedidos, el texto cubre los dos casos', () => {
    const [primero] = ownerLinks(publicado, { hasServices: true })
    expect(primero.purpose).toContain('Si tienes los pedidos activados')
  })

  it('sin nada capturado no lo destaca ni promete precios', () => {
    const [primero] = ownerLinks(publicado, { hasServices: false })
    expect(primero.key).toBe('ordenar')
    expect(primero.featured).toBeFalsy()
    expect(primero.purpose).not.toContain('precios')
  })

  it('arma las URLs públicas con el slug', () => {
    expect(ownerLinks(publicado, opts).map((l) => l.url)).toEqual([
      'https://vichente.com/mr-xilaquil/ordenar',
      'https://vichente.com/mr-xilaquil',
    ])
  })

  it('no ofrece el menú de mesa ni la entrada general a Vichente', () => {
    const urls = ownerLinks(publicado, opts).map((l) => l.url)
    expect(urls).not.toContain('https://vichente.com/mr-xilaquil/menu')
    expect(urls).not.toContain('https://vichente.com/app')
  })

  it('ningún link lleva src, para no contar scans falsos', () => {
    for (const l of ownerLinks(publicado, opts)) expect(l.url).not.toContain('src=')
    expect(ownerMenuUrl(publicado, true)).not.toContain('src=')
  })
})

describe('link del QR de mesa', () => {
  it('apunta al menú del negocio', () => {
    expect(ownerMenuUrl(publicado, true)).toBe('https://vichente.com/mr-xilaquil/menu')
  })

  it('sin nada capturado, sin publicar o sin slug no hay link', () => {
    expect(ownerMenuUrl(publicado, false)).toBeNull()
    expect(ownerMenuUrl({ slug: 'mr-xilaquil', is_active: false }, true)).toBeNull()
    expect(ownerMenuUrl({ slug: null, is_active: true }, true)).toBeNull()
  })
})
