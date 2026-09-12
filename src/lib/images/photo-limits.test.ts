import { describe, expect, it } from 'vitest'
import { PHOTO_MAX_BYTES, PHOTO_PICKER_ACCEPT, photoUploadRejection } from './photo-limits'

const MB = 1024 * 1024

describe('photoUploadRejection', () => {
  it('deja pasar los tres formatos del picker', () => {
    expect(photoUploadRejection('image/jpeg', 2 * MB)).toBeNull()
    expect(photoUploadRejection('image/png', 2 * MB)).toBeNull()
    expect(photoUploadRejection('image/webp', 2 * MB)).toBeNull()
  })

  // Es el caso de iOS: createImageBitmap no decodifica HEIC, compressImage
  // devuelve el original y el bucket lo acepta a propósito. Rechazarlo acá
  // sería romper la captura de campo desde un iPhone.
  it('deja pasar un HEIC de iPhone que cabe en el límite', () => {
    expect(photoUploadRejection('image/heic', 3 * MB)).toBeNull()
    expect(photoUploadRejection('image/heif', 3 * MB)).toBeNull()
  })

  it('rechaza un formato que el bucket no acepta, nombrándolo', () => {
    expect(photoUploadRejection('image/tiff', MB)).toMatch(/TIFF/)
    expect(photoUploadRejection('application/pdf', MB)).toMatch(/PDF/)
  })

  it('rechaza un archivo sin tipo reconocible', () => {
    expect(photoUploadRejection('', MB)).toMatch(/formato/i)
  })

  it('rechaza por tamaño cuando el formato sí es válido', () => {
    expect(photoUploadRejection('image/webp', PHOTO_MAX_BYTES + 1)).toMatch(/5 MB/)
    expect(photoUploadRejection('image/heic', 20 * MB)).toMatch(/20 MB/)
  })

  it('acepta justo en el límite', () => {
    expect(photoUploadRejection('image/jpeg', PHOTO_MAX_BYTES)).toBeNull()
  })
})

describe('PHOTO_PICKER_ACCEPT', () => {
  it('no ofrece HEIC en el picker: sólo entra como fallback de la cámara', () => {
    expect(PHOTO_PICKER_ACCEPT).toBe('image/jpeg,image/png,image/webp')
  })
})
