'use server'

import { revalidatePath } from 'next/cache'
import type { TablesUpdate } from '@/lib/database.types'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_PHOTOS_BUCKET, pathFromPublicUrl } from '@/lib/storage'
import { getCurrentProfile } from '@/features/auth/queries'
import {
  menuItemCreateSchema,
  menuItemPatchSchema,
  menuItemVisibilitySchema,
  menuMoveSchema,
} from './schema'
import { MENU_ITEM_COLUMNS, toMenuItem, type MenuItem } from './queries'

// ─────────────────────────────────────────────────────────────────────────────
// Por qué existe este archivo en vez de reusar `businesses/actions.ts`:
//
// `updateBusiness` guardaba el menú con DELETE-ALL-THEN-INSERT (`upsertServices`,
// borrado el 2026-09-02): borraba TODOS los `business_services` del negocio y
// los reinsertaba con `order_index` = posición en el array. Servía para un form
// que siempre manda el menú completo — pero significaba que (a) no existía
// guardado parcial y (b) los ids se regeneraban en cada guardado.
//
// Con 83 platillos (Mariscos La Joya) eso vuelve imposible corregir un precio
// sin re-enviar el menú entero con sus fotos. Este archivo direcciona FILAS
// INDIVIDUALES por id: una escritura toca una fila y deja las otras 82 con su
// mismo id y su mismo order_index. No sustituir por `updateBusiness`, y no
// fusionar los dos caminos "para simplificar": son transaccionalidades
// distintas a propósito.
//
// Es el mismo motivo por el que existe `features/field/actions.ts`.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LA TRAMPA CENTRAL DE ESTE ARCHIVO: una escritura que RLS rechaza NO siempre
// da error. Verificado end-to-end contra la DB local con login real:
//
//   INSERT rechazado -> HTTP 403 (sí hay `error`)
//   UPDATE rechazado -> HTTP 200 con []  (cero filas, `error` null)
//   DELETE rechazado -> HTTP 200 con []  (cero filas, `error` null)
//
// O sea: sin detectar "0 filas afectadas" el editor le diría "guardado" a un
// reviewer que no guardó nada. Por eso TODA escritura de acá va con `.select()`
// y pasa por `affectedOne()`. Es el mismo motivo por el que `deleteBusiness`
// lleva su guard explícito (ver comentarios en businesses/actions.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type MenuActionResult = { error: string | null }
export type MenuItemResult = { error: string | null; item: MenuItem | null }

const OK: MenuActionResult = { error: null }

// Mensajes en lenguaje llano: quien los va a leer captura menús, no lee logs.
// Nada de nombres de columna ni de "0 filas afectadas".
const NOT_FOUND = 'Ese platillo ya no existe en este negocio.'
const NOT_ALLOWED = 'No puedes editar el menú de este negocio: solo los de tu municipio.'
// El rechazo silencioso no dice POR QUÉ, así que el mensaje no inventa la causa.
const BLOCKED =
  'No se guardó nada. Puede que no tengas permiso sobre este negocio o que el platillo ya no exista. Vuelve a cargar la pantalla.'

function firstIssue(err: import('zod').ZodError): string {
  return err.issues[0]?.message ?? 'Datos inválidos.'
}

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * La regla de autorización, en UN SOLO LUGAR — y además la misma que aplica la
 * DB: llama a `can_edit_business(uuid)`, la función SQL que usan las policies
 * de `business_services` (migración 20260902120000). Reimplementar acá el
 * "admin o reviewer del mismo municipio" sería una segunda copia que se
 * desincroniza; el día que un dueño de negocio edite su propia ficha se cambia
 * la función SQL y este guard la sigue solo.
 *
 * No sustituye al chequeo de filas afectadas: esto evita el trabajo inútil y da
 * un mensaje decente, pero la protección real es RLS. Ambos se quedan.
 */
async function assertCanEditBusiness(
  supabase: Supabase,
  businessId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('can_edit_business', {
    target_business_id: businessId,
  })
  if (error) return error.message
  return data === true ? null : NOT_ALLOWED
}

/**
 * Traduce el resultado de una escritura con `.select()` a error legible.
 * `rows.length === 0` sin error es exactamente el rechazo silencioso de RLS.
 */
function affectedOne(rows: unknown[] | null, error: { message: string } | null): string | null {
  if (error) return error.message
  if (!rows || rows.length === 0) return BLOCKED
  return null
}

/** Best-effort: un huérfano en el bucket molesta, no debe romper el guardado. */
async function removeStoredPhoto(supabase: Supabase, url: string | null | undefined) {
  if (!url) return
  const path = pathFromPublicUrl(url)
  if (!path) return
  try {
    await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).remove([path])
  } catch {
    // Huérfano en el bucket: molesto, no bloqueante.
  }
}

/**
 * Ortografía final de la sección. Se decide en el server, no en la UI: hoy
 * "Bebidas", "bebidas" y "Bebidas " quedan como tres secciones distintas en el
 * menú de mesa, que agrupa por el texto exacto.
 *
 * Regla: trim + colapsar espacios internos; si ya existe una sección DEL MISMO
 * NEGOCIO que empate ignorando mayúsculas, se guarda con la ortografía que ya
 * existía. Sin tabla de secciones (sigue fuera de scope).
 *
 * `excludeItemId` es lo que permite CORREGIR la capitalización de una sección
 * que sólo usa ese ítem: sin excluirlo, la fila se empataría consigo misma y el
 * cambio se revertiría en silencio. Si la sección la comparten varios ítems, la
 * ortografía vieja gana — renombrar una sección completa no es esta operación.
 *
 * Los acentos NO se normalizan: "Café" y "Cafe" quedan como dos secciones. Es a
 * propósito — colapsarlos elegiría por el usuario cuál de las dos es la buena.
 */
async function canonicalSection(
  supabase: Supabase,
  businessId: string,
  raw: string | null,
  excludeItemId?: string,
): Promise<string | null> {
  if (!raw) return null
  const normalized = raw.trim().replace(/\s+/g, ' ')
  if (!normalized) return null

  const query = supabase
    .from('business_services')
    .select('id, section')
    .eq('business_id', businessId)
    .not('section', 'is', null)
  const { data } = excludeItemId ? await query.neq('id', excludeItemId) : await query

  const key = normalized.toLocaleLowerCase('es-MX')
  for (const row of data ?? []) {
    const existing = (row.section ?? '').trim().replace(/\s+/g, ' ')
    if (existing && existing.toLocaleLowerCase('es-MX') === key) return existing
  }
  return normalized
}

/**
 * No se revalida la ruta del editor de menú a propósito — mismo motivo que
 * `patchBusinessFields` en field/actions.ts: re-renderizar el RSC mientras se
 * edita pisaría el estado del componente cliente. Se revalidan la lista y la
 * ficha del negocio, que sí muestran datos derivados del menú.
 */
function revalidateMenu(businessId: string) {
  revalidatePath('/businesses')
  revalidatePath(`/businesses/${businessId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Alta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega un ítem AL FINAL del menú (`max(order_index) + 1`).
 *
 * Va al final del catálogo, no al final de su sección: el menú de mesa agrupa
 * por sección tolerando ítems no contiguos (`agruparPorSeccion` en
 * landing/src/lib/menu-de-mesa.ts), así que el platillo nuevo aparece al final
 * de su grupo sin tener que reindexar a los que ya estaban.
 *
 * Si el insert no entra, la foto que el cliente acaba de subir se borra acá: es
 * el único punto que sabe con certeza que la fila no quedó.
 */
export async function createMenuItem(businessId: string, input: unknown): Promise<MenuItemResult> {
  const parsed = menuItemCreateSchema.safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error), item: null }

  const supabase = await createClient()
  const denied = await assertCanEditBusiness(supabase, businessId)
  if (denied) {
    await removeStoredPhoto(supabase, parsed.data.image_url)
    return { error: denied, item: null }
  }

  const actorId = (await getCurrentProfile())?.id ?? null
  const section = await canonicalSection(supabase, businessId, parsed.data.section)

  const { data: last } = await supabase
    .from('business_services')
    .select('order_index')
    .eq('business_id', businessId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = last && last.length > 0 ? last[0].order_index + 1 : 0

  const { data: inserted, error } = await supabase
    .from('business_services')
    .insert({
      business_id: businessId,
      name: parsed.data.name,
      price: parsed.data.price,
      description: parsed.data.description,
      image_url: parsed.data.image_url,
      section,
      is_published: parsed.data.is_published,
      show_in_profile: parsed.data.show_in_profile,
      order_index: nextIndex,
      created_by: actorId,
      updated_by: actorId,
    })
    .select(MENU_ITEM_COLUMNS)
    .single()

  if (error || !inserted) {
    await removeStoredPhoto(supabase, parsed.data.image_url)
    return { error: error?.message ?? BLOCKED, item: null }
  }

  revalidateMenu(businessId)
  return { error: null, item: toMenuItem(inserted) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edición
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda UN ítem. Escribe sólo esa fila: los demás conservan su id y su
 * order_index.
 *
 * `image_url` es de tres estados y la diferencia importa:
 *   - clave ausente  -> no se toca la foto
 *   - `null`         -> se quita la foto y se borra el archivo viejo
 *   - una URL nueva  -> se reemplaza y se borra el archivo viejo
 *
 * Orden de las operaciones sobre storage (no invertir): primero se confirma que
 * el UPDATE escribió, y hasta entonces se borra el archivo viejo. Al revés, un
 * update rechazado por RLS —que devuelve 200 con []— dejaría la fila apuntando
 * a un archivo ya borrado. Si el update NO entra y venía una foto nueva, se
 * borra la nueva para no dejarla colgada en el bucket.
 *
 * `.eq('business_id')` además del id no es redundante: un id de otro negocio
 * debe afectar 0 filas en vez de escribir donde no debe.
 */
export async function updateMenuItem(
  businessId: string,
  itemId: string,
  patch: unknown,
): Promise<MenuItemResult> {
  const parsed = menuItemPatchSchema.safeParse(patch)
  if (!parsed.success) return { error: firstIssue(parsed.error), item: null }

  const changesPhoto = 'image_url' in parsed.data
  const nextPhoto = changesPhoto ? (parsed.data.image_url ?? null) : null

  const supabase = await createClient()

  // La foto vieja se lee ANTES de escribir o se pierde el path a limpiar. El
  // SELECT de business_services está abierto a `authenticated` (no scopeado por
  // municipio, ver 20260711120000), así que esto funciona incluso para el
  // reviewer al que después se le va a negar la escritura.
  const { data: current } = await supabase
    .from('business_services')
    .select('id, image_url')
    .eq('id', itemId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (!current) return { error: NOT_FOUND, item: null }

  const photoChanged = changesPhoto && nextPhoto !== current.image_url

  const denied = await assertCanEditBusiness(supabase, businessId)
  if (denied) {
    if (photoChanged) await removeStoredPhoto(supabase, nextPhoto)
    return { error: denied, item: null }
  }

  if (Object.keys(parsed.data).length === 0) {
    const { data } = await supabase
      .from('business_services')
      .select(MENU_ITEM_COLUMNS)
      .eq('id', itemId)
      .maybeSingle()
    return { error: null, item: data ? toMenuItem(data) : null }
  }

  const values: TablesUpdate<'business_services'> = {
    updated_by: (await getCurrentProfile())?.id ?? null,
  }
  if ('name' in parsed.data) values.name = parsed.data.name
  if ('price' in parsed.data) values.price = parsed.data.price
  if ('description' in parsed.data) values.description = parsed.data.description
  if ('is_published' in parsed.data) values.is_published = parsed.data.is_published
  if ('show_in_profile' in parsed.data) values.show_in_profile = parsed.data.show_in_profile
  if (changesPhoto) values.image_url = nextPhoto
  if ('section' in parsed.data) {
    values.section = await canonicalSection(
      supabase,
      businessId,
      parsed.data.section ?? null,
      itemId,
    )
  }

  const { data: rows, error } = await supabase
    .from('business_services')
    .update(values)
    .eq('id', itemId)
    .eq('business_id', businessId)
    .select(MENU_ITEM_COLUMNS)

  const failure = affectedOne(rows, error)
  if (failure || !rows?.[0]) {
    if (photoChanged) await removeStoredPhoto(supabase, nextPhoto)
    return { error: failure ?? BLOCKED, item: null }
  }

  // Recién ahora: la fila ya no apunta al archivo viejo.
  if (photoChanged) await removeStoredPhoto(supabase, current.image_url)

  revalidateMenu(businessId)
  return { error: null, item: toMenuItem(rows[0]) }
}

/**
 * Toggles de un bit (visible / sale en el perfil). Escriben al toque, sin botón
 * de guardar: no pueden dejar una fila a medias porque no tocan `name`.
 */
export async function setMenuItemVisibility(
  businessId: string,
  itemId: string,
  visibility: unknown,
): Promise<MenuActionResult> {
  const parsed = menuItemVisibilitySchema.safeParse(visibility)
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const supabase = await createClient()
  const denied = await assertCanEditBusiness(supabase, businessId)
  if (denied) return { error: denied }

  const values: TablesUpdate<'business_services'> = {
    updated_by: (await getCurrentProfile())?.id ?? null,
  }
  if (parsed.data.is_published !== undefined) values.is_published = parsed.data.is_published
  if (parsed.data.show_in_profile !== undefined) {
    values.show_in_profile = parsed.data.show_in_profile
  }

  const { data: rows, error } = await supabase
    .from('business_services')
    .update(values)
    .eq('id', itemId)
    .eq('business_id', businessId)
    .select('id')

  const failure = affectedOne(rows, error)
  if (failure) return { error: failure }

  revalidateMenu(businessId)
  return OK
}

// ─────────────────────────────────────────────────────────────────────────────
// Baja
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Borra un ítem y limpia su foto del bucket.
 *
 * La URL se lee antes del delete (después ya no hay fila de dónde sacarla) pero
 * el archivo se borra DESPUÉS de confirmar que el delete afectó una fila: un
 * delete rechazado por RLS devuelve 200 con [] y borrar antes dejaría la fila
 * viva apuntando a un archivo inexistente. Mismo orden que `removeFieldPhoto`.
 */
export async function deleteMenuItem(
  businessId: string,
  itemId: string,
): Promise<MenuActionResult> {
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('business_services')
    .select('id, image_url')
    .eq('id', itemId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (!current) return { error: NOT_FOUND }

  const denied = await assertCanEditBusiness(supabase, businessId)
  if (denied) return { error: denied }

  const { data: rows, error } = await supabase
    .from('business_services')
    .delete()
    .eq('id', itemId)
    .eq('business_id', businessId)
    .select('id')

  const failure = affectedOne(rows, error)
  if (failure) return { error: failure }

  await removeStoredPhoto(supabase, current.image_url)

  revalidateMenu(businessId)
  return OK
}

// ─────────────────────────────────────────────────────────────────────────────
// Orden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mueve un ítem una posición arriba o abajo INTERCAMBIANDO el `order_index` con
 * su vecino. Dos filas escritas, no el catálogo entero: renumerar 83 filas por
 * cada toque es justo lo que hace el guardado viejo.
 *
 * `order_index` no es único a propósito, así que los dos UPDATE secuenciales no
 * chocan (mismo razonamiento que `setFieldCoverPhoto`).
 *
 * El vecino se calcula sobre el MISMO orden que lee el editor
 * (`order_index`, luego `name`), no sobre el índice crudo — si no, mover
 * saltaría filas cuando hay empates.
 *
 * Empates: hoy no hay ninguno (el guardado viejo siempre dejó 0..n-1 únicos y
 * las altas nuevas usan max+1), pero si aparecieran, intercambiar dos índices
 * iguales sería un no-op silencioso — otra vez el "guardé y no pasó nada". Por
 * eso, y sólo en ese caso, se compacta el menú a 0..n-1 respetando el orden que
 * ya se veía y después se intercambia. Es una reparación puntual de datos
 * degenerados, no el camino normal.
 */
export async function moveMenuItem(
  businessId: string,
  itemId: string,
  direction: unknown,
): Promise<MenuActionResult> {
  const parsed = menuMoveSchema.safeParse(direction)
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const supabase = await createClient()
  const denied = await assertCanEditBusiness(supabase, businessId)
  if (denied) return { error: denied }

  let ordered = await readOrder(supabase, businessId)
  if (ordered === null) return { error: 'No se pudo leer el menú.' }

  let position = ordered.findIndex((r) => r.id === itemId)
  if (position === -1) return { error: NOT_FOUND }

  let target = parsed.data === 'up' ? position - 1 : position + 1
  if (target < 0 || target >= ordered.length) return OK // ya está en el extremo

  if (ordered[position].order_index === ordered[target].order_index) {
    const repaired = await compactOrder(supabase, businessId, ordered)
    if (repaired) return { error: repaired }
    ordered = await readOrder(supabase, businessId)
    if (ordered === null) return { error: 'No se pudo leer el menú.' }
    position = ordered.findIndex((r) => r.id === itemId)
    if (position === -1) return { error: NOT_FOUND }
    target = parsed.data === 'up' ? position - 1 : position + 1
    if (target < 0 || target >= ordered.length) return OK
  }

  const mine = ordered[position]
  const theirs = ordered[target]

  const first = await writeOrderIndex(supabase, businessId, mine.id, theirs.order_index)
  if (first) return { error: first }
  const second = await writeOrderIndex(supabase, businessId, theirs.id, mine.order_index)
  if (second) return { error: second }

  revalidateMenu(businessId)
  return OK
}

type OrderRow = { id: string; order_index: number }

async function readOrder(supabase: Supabase, businessId: string): Promise<OrderRow[] | null> {
  const { data, error } = await supabase
    .from('business_services')
    .select('id, order_index')
    .eq('business_id', businessId)
    .order('order_index')
    .order('name')
  if (error) return null
  return data ?? []
}

async function writeOrderIndex(
  supabase: Supabase,
  businessId: string,
  itemId: string,
  orderIndex: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('business_services')
    .update({ order_index: orderIndex })
    .eq('id', itemId)
    .eq('business_id', businessId)
    .select('id')
  return affectedOne(data, error)
}

/** Reparación: deja 0..n-1 en el orden que ya se veía. Ver `moveMenuItem`. */
async function compactOrder(
  supabase: Supabase,
  businessId: string,
  ordered: OrderRow[],
): Promise<string | null> {
  for (const [index, row] of ordered.entries()) {
    if (row.order_index === index) continue
    const failure = await writeOrderIndex(supabase, businessId, row.id, index)
    if (failure) return failure
  }
  return null
}
