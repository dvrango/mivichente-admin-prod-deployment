'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chip } from './chip'

// ─────────────────────────────────────────────────────────────────────────────
// Los grupos de opciones del platillo: sabor, tipo de leche, extras que cuestan.
//
// Sale a su propio archivo porque trae un nivel más de anidamiento que los
// tamaños (grupo -> opciones) y dentro de `menu-item-form.tsx` lo dejaría en
// ~800 líneas.
//
// APLICA LA MISMA REGLA DE LAYOUT que ese archivo, y por el mismo motivo: cada
// campo que se teclea ocupa SU PROPIA FILA COMPLETA, y sólo comparten fila los
// botones con texto dentro de un grid de columnas iguales. Esta pantalla se usa
// parado en el negocio, desde el celular, a 360px.
//
// Nada de aquí habla con el server: recibe el borrador y su setter, y todo sale
// por el mismo botón de Guardar del formulario.
//
// Los NÚMEROS NO SE TECLEAN COMO NÚMEROS. La base modela "obligatorio" como
// `min_select >= 1` y "sin tope" como `max_select is null`; quien captura no
// tiene por qué saber eso, así que acá se pregunta en español y `schema.ts`
// traduce (`toOptionGroupRow`).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una opción dentro de un grupo. `id` presente = ya existía en la base y
 * conserva su identidad al guardar; ausente = recién agregada.
 *
 * `price_delta` viaja como string por lo mismo que los demás precios del
 * formulario: es lo que hay en un `<input>`, y convertirlo acá obligaría a
 * inventar qué significa "" antes de que el schema lo valide. Vacío = sin costo.
 *
 * SE LLAMA `price_delta` Y NO `priceDelta` A PROPÓSITO, aunque desentone: el
 * borrador se manda tal cual a la server action, y ahí lo parsea `schema.ts`,
 * que espera el nombre de la columna. Nada cruza los dos tipos estáticamente
 * —el payload viaja como `unknown`—, así que renombrarlo a camelCase compila
 * perfecto y falla al guardar con "Invalid input: expected string, received
 * undefined". Pasó en el QA de esta tarea.
 *
 * La regla que queda: el campo que ES una columna lleva el nombre de la columna;
 * el que es una pregunta inventada por la UI (`required`, `maxSelect`) va en
 * camelCase, porque no existe del otro lado hasta que `toOptionGroupRow` lo
 * traduce.
 */
export type MenuOptionDraft = {
  id?: string
  name: string
  price_delta: string
}

/**
 * `maxMode` es la respuesta a "¿cuántas puede elegir?" y `maxSelect` sólo
 * importa cuando esa respuesta es `'hasta'`. La traducción a la columna
 * `max_select` la hace `schema.ts`: `'una'` -> 1, `'todas'` -> null, `'hasta'`
 * -> el número tecleado.
 *
 * EL MODO NO SE DEDUCE DEL NÚMERO, aunque "hasta 1" y "solo una" signifiquen lo
 * mismo. Deducirlo hacía desaparecer el campo a media edición: quien iba a
 * escribir 15 tecleaba el "1", el modo se releía como "solo una" y el input se
 * ocultaba antes del segundo dígito.
 *
 * `maxSelect` es string y no number por lo mismo que `price_delta`: es lo que
 * hay en un `<input>`, y mientras se teclea pasa por estados que no son un
 * número válido — el campo vacío, un "1" que va camino a "15".
 */
export type MenuOptionGroupDraft = {
  id?: string
  name: string
  required: boolean
  maxMode: 'una' | 'hasta' | 'todas'
  maxSelect: string
  options: MenuOptionDraft[]
}

type Props = {
  /** "platillo" o "servicio", derivado del título del negocio. */
  word: string
  groups: MenuOptionGroupDraft[]
  onChange: (groups: MenuOptionGroupDraft[]) => void
  saving: boolean
}

export function OptionGroupsField({ word, groups, onChange, saving }: Props) {
  function updateGroup(index: number, patch: Partial<MenuOptionGroupDraft>) {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)))
  }

  function addGroup() {
    // Arranca obligatorio y de una sola opción: es lo que pide la mayoría de los
    // menús reales (el sabor de un café, la leche, la fruta de una crepa). Quien
    // captura un extra opcional lo cambia con un toque.
    onChange([...groups, { name: '', required: true, maxMode: 'una', maxSelect: '2', options: [] }])
  }

  function removeGroup(index: number) {
    onChange(groups.filter((_, i) => i !== index))
  }

  function moveGroup(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= groups.length) return
    const next = [...groups]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function addOption(groupIndex: number) {
    const group = groups[groupIndex]
    updateGroup(groupIndex, { options: [...group.options, { name: '', price_delta: '' }] })
  }

  function updateOption(groupIndex: number, optionIndex: number, patch: Partial<MenuOptionDraft>) {
    const group = groups[groupIndex]
    updateGroup(groupIndex, {
      options: group.options.map((o, i) => (i === optionIndex ? { ...o, ...patch } : o)),
    })
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    const group = groups[groupIndex]
    updateGroup(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })
  }

  function moveOption(groupIndex: number, optionIndex: number, direction: -1 | 1) {
    const group = groups[groupIndex]
    const target = optionIndex + direction
    if (target < 0 || target >= group.options.length) return
    const next = [...group.options]
    ;[next[optionIndex], next[target]] = [next[target], next[optionIndex]]
    updateGroup(groupIndex, { options: next })
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Opciones para elegir</label>
      <p className="text-muted-foreground text-xs">
        Lo que el cliente escoge al pedir: sabor, tipo de leche, o un extra que cuesta aparte. Si el{' '}
        {word} se pide tal cual, deja esto vacío.
      </p>

      {groups.length > 0 && (
        <div className="space-y-2 pt-1">
          {groups.map((group, groupIndex) => (
            <div
              key={group.id ?? `nuevo-${groupIndex}`}
              className="space-y-3 rounded-md border p-2"
            >
              {/* Nombre del grupo — fila completa, sin vecinos. */}
              <div className="space-y-1">
                <Input
                  className="h-11 md:h-9"
                  value={group.name}
                  onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
                  placeholder="Ej. Sabor"
                  aria-label={`Nombre del grupo ${groupIndex + 1}`}
                  disabled={saving}
                />
                <p className="text-muted-foreground text-xs">
                  Es el encabezado que ve el cliente arriba de las opciones.
                </p>
              </div>

              {/* ¿Tiene que elegir? -> min_select 1 ó 0. */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">¿Tiene que elegir?</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={group.required}
                    disabled={saving}
                    onClick={() => updateGroup(groupIndex, { required: true })}
                  >
                    Sí, es obligatorio
                  </Chip>
                  <Chip
                    active={!group.required}
                    disabled={saving}
                    onClick={() => updateGroup(groupIndex, { required: false })}
                  >
                    No, es opcional
                  </Chip>
                </div>
              </div>

              {/* ¿Cuántas? -> max_select 1, N o null. El campo numérico aparece
                  sólo con "Hasta…", igual que el input de sección tras "+ Otra". */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">¿Cuántas puede elegir?</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={group.maxMode === 'una'}
                    disabled={saving}
                    onClick={() => updateGroup(groupIndex, { maxMode: 'una' })}
                  >
                    Solo una
                  </Chip>
                  <Chip
                    active={group.maxMode === 'hasta'}
                    disabled={saving}
                    onClick={() => updateGroup(groupIndex, { maxMode: 'hasta' })}
                  >
                    Hasta…
                  </Chip>
                  <Chip
                    active={group.maxMode === 'todas'}
                    disabled={saving}
                    onClick={() => updateGroup(groupIndex, { maxMode: 'todas' })}
                  >
                    Las que quiera
                  </Chip>
                </div>
                {group.maxMode === 'hasta' && (
                  <Input
                    className="h-11 md:h-9"
                    type="number"
                    inputMode="numeric"
                    min="2"
                    step="1"
                    value={group.maxSelect}
                    // Se guarda TAL CUAL, sin coaccionar en cada tecla, y el
                    // campo no depende de lo que diga: el modo lo fija el chip.
                    // Lo valida `schema.ts` al guardar.
                    onChange={(e) => updateGroup(groupIndex, { maxSelect: e.target.value })}
                    aria-label={`Cuántas opciones puede elegir del grupo ${groupIndex + 1}`}
                    disabled={saving}
                  />
                )}
              </div>

              {/* Las opciones del grupo. Cada campo, su fila. */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Opciones</p>
                {group.options.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    Todavía no hay ninguna.{' '}
                    {group.required && 'Como es obligatorio, necesita al menos una.'}
                  </p>
                )}
                {group.options.map((option, optionIndex) => (
                  <div
                    key={option.id ?? `nueva-${optionIndex}`}
                    className="bg-muted/40 space-y-2 rounded-md p-2"
                  >
                    <Input
                      className="h-11 md:h-9"
                      value={option.name}
                      onChange={(e) =>
                        updateOption(groupIndex, optionIndex, { name: e.target.value })
                      }
                      placeholder="Ej. capuchino"
                      aria-label={`Nombre de la opción ${optionIndex + 1} del grupo ${groupIndex + 1}`}
                      disabled={saving}
                    />
                    <Input
                      className="h-11 md:h-9"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={option.price_delta}
                      onChange={(e) =>
                        updateOption(groupIndex, optionIndex, { price_delta: e.target.value })
                      }
                      placeholder="Cuesta extra (déjalo vacío si no)"
                      aria-label={`Costo extra de la opción ${optionIndex + 1} del grupo ${groupIndex + 1}`}
                      disabled={saving}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={saving || optionIndex === 0}
                        onClick={() => moveOption(groupIndex, optionIndex, -1)}
                      >
                        <ArrowUp className="size-4" />
                        Subir
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={saving || optionIndex === group.options.length - 1}
                        onClick={() => moveOption(groupIndex, optionIndex, 1)}
                      >
                        <ArrowDown className="size-4" />
                        Bajar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-9"
                        disabled={saving}
                        onClick={() => removeOption(groupIndex, optionIndex)}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full md:h-9"
                  onClick={() => addOption(groupIndex)}
                  disabled={saving}
                >
                  Agregar opción
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 md:h-9"
                  disabled={saving || groupIndex === 0}
                  onClick={() => moveGroup(groupIndex, -1)}
                >
                  <ArrowUp className="size-4" />
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 md:h-9"
                  disabled={saving || groupIndex === groups.length - 1}
                  onClick={() => moveGroup(groupIndex, 1)}
                >
                  <ArrowDown className="size-4" />
                  Bajar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground h-10 md:h-9"
                  disabled={saving}
                  onClick={() => removeGroup(groupIndex)}
                >
                  Quitar grupo
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full md:h-9"
        onClick={addGroup}
        disabled={saving}
      >
        Agregar grupo de opciones
      </Button>
    </div>
  )
}

/**
 * Las filas en blanco se descartan al guardar en vez de bloquear el submit —
 * quedan al agregar algo y arrepentirse, y exigir que se borren a mano es
 * fricción sin propósito. Mismo criterio que ya aplica el formulario a los
 * tamaños.
 *
 * Un grupo se considera en blanco cuando no tiene nombre NI opciones con algo
 * escrito: si tiene nombre pero ninguna opción, se manda tal cual para que el
 * schema diga que un grupo obligatorio necesita al menos una.
 */
export function limpiarGrupos(groups: MenuOptionGroupDraft[]): MenuOptionGroupDraft[] {
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((o) => o.name.trim() !== '' || o.price_delta.trim() !== ''),
    }))
    .filter((group) => group.name.trim() !== '' || group.options.length > 0)
}
