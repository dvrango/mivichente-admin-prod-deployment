'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FIELD_SAVE_DEBOUNCE_MS } from '../constants'
import { patchBusinessFields } from '../actions'
import type { FieldPatch, FieldPatchKey } from '../schema'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/**
 * Guardado incremental campo por campo.
 *
 * Cada campo se guarda solo tras `FIELD_SAVE_DEBOUNCE_MS`, y de inmediato al
 * salir del input o al esconderse la pestaña (se bloquea el teléfono, entra una
 * llamada). Así una interrupción a media captura no pierde nada.
 *
 * Cada campo lleva su propio token monotónico: si un guardado lento contesta
 * después de uno más nuevo, su resultado se descarta en vez de pisar el estado.
 */
export function useFieldSave(businessId: string) {
  const [status, setStatus] = useState<Partial<Record<FieldPatchKey, SaveStatus>>>({})

  const timers = useRef(new Map<FieldPatchKey, ReturnType<typeof setTimeout>>())
  const pending = useRef(new Map<FieldPatchKey, FieldPatch[FieldPatchKey]>())
  const tokens = useRef(new Map<FieldPatchKey, number>())

  const flush = useCallback(
    async (key: FieldPatchKey) => {
      const timer = timers.current.get(key)
      if (timer) {
        clearTimeout(timer)
        timers.current.delete(key)
      }
      if (!pending.current.has(key)) return

      const value = pending.current.get(key)
      pending.current.delete(key)

      const token = (tokens.current.get(key) ?? 0) + 1
      tokens.current.set(key, token)

      setStatus((s) => ({ ...s, [key]: 'saving' }))
      const result = await patchBusinessFields(businessId, { [key]: value })

      // Llegó tarde: ya hay un guardado más nuevo en vuelo para este campo.
      if (tokens.current.get(key) !== token) return
      setStatus((s) => ({ ...s, [key]: result.error ? 'error' : 'saved' }))
    },
    [businessId],
  )

  const save = useCallback(
    (key: FieldPatchKey, value: FieldPatch[FieldPatchKey]) => {
      pending.current.set(key, value)
      setStatus((s) => ({ ...s, [key]: 'dirty' }))

      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => void flush(key), FIELD_SAVE_DEBOUNCE_MS),
      )
    },
    [flush],
  )

  const flushAll = useCallback(() => {
    for (const key of [...pending.current.keys()]) void flush(key)
  }, [flush])

  /**
   * Guarda varios campos en UNA sola llamada, sin debounce. Para datos que
   * llegan juntos de un evento puntual y no de tecleo — el GPS manda lat, lng,
   * precisión y maps_url de un jalón, y guardarlos por separado dejaría estados
   * intermedios incoherentes (coordenadas sin URL o al revés).
   */
  const saveNow = useCallback(
    async (patch: FieldPatch) => {
      const keys = Object.keys(patch) as FieldPatchKey[]
      for (const key of keys) {
        tokens.current.set(key, (tokens.current.get(key) ?? 0) + 1)
      }
      setStatus((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, 'saving'])) }))
      const result = await patchBusinessFields(businessId, patch)
      setStatus((s) => ({
        ...s,
        ...Object.fromEntries(keys.map((k) => [k, result.error ? 'error' : 'saved'])),
      }))
      return result
    },
    [businessId],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    document.addEventListener('visibilitychange', onHide)
    const pendingTimers = timers.current
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      for (const timer of pendingTimers.values()) clearTimeout(timer)
    }
  }, [flushAll])

  /** Estado agregado para el pill del header. */
  const overall: SaveStatus = Object.values(status).includes('saving')
    ? 'saving'
    : Object.values(status).includes('error')
      ? 'error'
      : Object.values(status).includes('dirty')
        ? 'dirty'
        : Object.values(status).includes('saved')
          ? 'saved'
          : 'idle'

  return { status, overall, save, saveNow, flush, flushAll }
}
