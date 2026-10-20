import { describe, expect, it } from 'vitest'
import { extensionDe, nombreBase } from './descargar-archivo'

describe('extensión de la foto descargada', () => {
  it('manda el tipo real aunque la URL diga otra cosa', () => {
    expect(extensionDe('image/webp', 'https://x.supabase.co/a/b.jpg')).toBe('webp')
  })

  it('ignora parámetros del Content-Type', () => {
    expect(extensionDe('image/jpeg; charset=binary', 'https://x/a')).toBe('jpg')
  })

  it('sin tipo conocido usa la extensión de la URL', () => {
    expect(extensionDe('', 'https://x/a/foto.PNG?v=2')).toBe('png')
    expect(extensionDe('application/octet-stream', 'https://x/a/foto.jpeg')).toBe('jpg')
  })

  it('sin tipo ni extensión cae en jpg', () => {
    expect(extensionDe('', 'https://images.unsplash.com/photo-123?w=800')).toBe('jpg')
  })
})

describe('nombre del archivo', () => {
  it('junta el slug con la etiqueta sin acentos', () => {
    expect(nombreBase('kffess', 'Capuchino frío')).toBe('kffess-capuchino-frio')
  })

  it('una etiqueta vacía deja sólo el slug', () => {
    expect(nombreBase('kffess', '¿?')).toBe('kffess')
  })
})
