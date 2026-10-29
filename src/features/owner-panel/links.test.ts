import { describe, expect, it } from 'vitest'
import { ownerLinks } from './links'

const publicado = { slug: 'mr-xilaquil', is_active: true }
const opts = { servicesLabel: 'Menú', hasServices: true }

describe('links del panel del dueño', () => {
  it('sin publicar o sin slug no da links', () => {
    expect(ownerLinks({ slug: 'mr-xilaquil', is_active: false }, opts)).toEqual([])
    expect(ownerLinks({ slug: null, is_active: true }, opts)).toEqual([])
  })

  it('arma las URLs públicas con el slug', () => {
    expect(ownerLinks(publicado, opts).map((l) => l.url)).toEqual([
      'https://vichente.com/mr-xilaquil',
      'https://vichente.com/mr-xilaquil/menu',
      'https://vichente.com/mr-xilaquil/ordenar',
      'https://vichente.com/app',
    ])
  })

  it('ningún link lleva src, para no contar scans falsos', () => {
    for (const l of ownerLinks(publicado, opts)) expect(l.url).not.toContain('src=')
  })

  it('sin nada capturado no ofrece el menú', () => {
    const keys = ownerLinks(publicado, { ...opts, hasServices: false }).map((l) => l.key)
    expect(keys).not.toContain('menu')
  })

  it('el link del menú usa la etiqueta del negocio', () => {
    const menu = ownerLinks(publicado, { servicesLabel: 'Productos', hasServices: true }).find(
      (l) => l.key === 'menu',
    )
    expect(menu?.title).toBe('Productos')
  })
})
