import { z } from 'zod'

// Validación de los ítems del menú (`business_services`) cuando se editan UNO
// POR UNO. Es la ÚNICA validación del menú desde el 2026-09-02: el form del
// negocio tenía la suya (`businesses/schema.ts` -> `serviceSchema`) para el
// submit completo, con el array entero y punteros al FormData, y se borró junto
// con su editor. Toda regla nueva del menú va acá y en ningún otro lado.

// numeric(10,2): 8 enteros + 2 decimales. Se topa acá para devolver un mensaje
// en español en vez de dejar que Postgres tire "numeric field overflow".
const PRICE_MAX = 100_000_000

// Vacío = sin precio público ("cotiza tu evento") -> null en la DB.
// Ojo con el orden del refine: `Number('')` es 0, así que el caso vacío se
// resuelve antes de mirar el número.
const priceSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Precio inválido.')
  .refine((v) => v === '' || Number(v) < PRICE_MAX, 'El precio es demasiado grande.')
  .transform((v) => (v === '' ? null : Number(v)))

// Una variante es un tamaño o presentación con su propio precio: "chica $90",
// "1/2 kilo $120". Van juntas en un array porque el editor las manda completas
// para UN platillo — a diferencia del catálogo de platillos, que se guarda uno
// por uno.
//
// `price` acá es REQUERIDO, al revés que en el platillo: una variante sin
// precio no tiene razón de existir. El caso "cotiza tu evento" se resuelve
// dejando el platillo sin variantes y sin precio, como siempre.
//
// `id` opcional: presente = variante que ya existía (se actualiza en su lugar,
// conservando el id), ausente = nueva. Eso permite corregir un precio sin
// regenerar las seis filas — que es justo lo que va a importar cuando un pedido
// guarde a qué variante apuntaba.
const variantPriceSchema = z
  .string()
  .trim()
  .refine((v) => v !== '', 'Cada tamaño necesita su precio.')
  .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, 'Precio inválido.')
  .refine((v) => Number(v) < PRICE_MAX, 'El precio es demasiado grande.')
  .transform((v) => Number(v))

export const menuVariantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Cada tamaño necesita un nombre.'),
  price: variantPriceSchema,
})
export type MenuVariantInput = z.infer<typeof menuVariantSchema>

// El orden del array ES el order_index, igual que en la galería de fotos. Tope
// de 20: un platillo con más presentaciones que eso es señal de que el dato
// está mal modelado, no de que haga falta más espacio.
export const menuVariantsSchema = z
  .array(menuVariantSchema, { message: 'Tamaños inválidos.' })
  .max(20, 'Demasiados tamaños para un solo platillo.')
  .refine(
    (list) => new Set(list.map((v) => v.name.toLowerCase())).size === list.length,
    'Hay dos tamaños con el mismo nombre.',
  )

// ─────────────────────────────────────────────────────────────────────────────
// Grupos de opciones: lo que el cliente ELIGE del platillo además del tamaño.
//
// La frontera con las variantes es qué le hacen al precio: el tamaño lo FIJA
// ("Grande $50"), la opción lo SUMA ("shot de espresso +$12"). Esa diferencia
// la razona la migración 20260916120000; acá sólo se valida.
//
// Estas reglas son el criterio de aceptación de la tarea, no adorno: quien
// captura es Sandra, y un grupo mal armado no truena en el admin — truena en el
// carrito, donde el cliente ve "elige 1 sabor" sin sabores y no puede pedir el
// platillo, sin ninguna señal de vuelta hacia acá.
// ─────────────────────────────────────────────────────────────────────────────

// Vacío = 0, NO error: la opción sin costo es el caso normal (de los grupos que
// necesita K-fféss, casi todos son elecciones que no cobran). Al revés que el
// precio de una variante, que sí es obligatorio.
//
// No-negativo porque la DB también lo prohíbe: un signo mal capturado bajaría el
// total sin síntoma en pantalla y el negocio lo descubriría al cobrar.
const priceDeltaSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0),
    'El costo extra tiene que ser un número de 0 en adelante.',
  )
  .refine((v) => v === '' || Number(v) < PRICE_MAX, 'El costo extra es demasiado grande.')
  .transform((v) => (v === '' ? 0 : Number(v)))

export const menuOptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Cada opción necesita un nombre.'),
  price_delta: priceDeltaSchema,
})
export type MenuOptionInput = z.infer<typeof menuOptionSchema>

/** Compara como comparaba el índice único que se quitó: sin mayúsculas ni espacios de sobra. */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX')
}

/** El primer nombre que aparece dos veces, o null. Se devuelve para poder NOMBRARLO. */
function firstDuplicate(names: string[]): string | null {
  const seen = new Set<string>()
  for (const name of names) {
    const key = nameKey(name)
    if (!key) continue
    if (seen.has(key)) return name.trim()
    seen.add(key)
  }
  return null
}

/**
 * Los nombres que el trigger `business_service_option_groups_reject_size`
 * rechaza en la DB. Se repiten acá para que el mensaje llegue ANTES de intentar
 * guardar, no para sustituir al trigger: la garantía sigue siendo suya.
 *
 * Si allá se agrega un nombre, se agrega acá. Normalizado igual que el trigger:
 * sin acentos, sin mayúsculas, con los espacios colapsados.
 */
const NOMBRES_DE_TAMANO = ['tamano', 'tamanos', 'size', 'sizes', 'presentacion', 'presentaciones']

function esNombreDeTamano(name: string): boolean {
  const normalizado = name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (c) => 'aeiouun'['áéíóúüñ'.indexOf(c)])
  return NOMBRES_DE_TAMANO.includes(normalizado)
}

const optionsSchema = z
  .array(menuOptionSchema, { message: 'Opciones inválidas.' })
  .max(30, 'Demasiadas opciones para un solo grupo.')

/**
 * El tope que va a la columna `max_select`, a partir de lo que respondió el
 * formulario. null = sin tope.
 *
 * "Hasta…" con un número inválido devuelve null acá, pero no se cuela: el
 * `superRefine` ya emitió su propio error y el parseo no llega a `transform`.
 */
function maxSelectDe(group: {
  maxMode: 'una' | 'hasta' | 'todas'
  maxSelect: string
}): number | null {
  if (group.maxMode === 'una') return 1
  if (group.maxMode === 'todas') return null
  return /^\d+$/.test(group.maxSelect.trim()) ? Number(group.maxSelect) : null
}

/**
 * Un grupo. `required`, `maxMode` y `maxSelect` son las RESPUESTAS que el
 * formulario sabe pedir; la traducción a las columnas `min_select` /
 * `max_select` la hace `toOptionGroupRow` al escribir, no la UI.
 *
 * El mínimo nunca pasa de 1 desde el admin: la DB admite "elige al menos 2",
 * ningún menú lo ha pedido, y ofrecerlo cobraría claridad a todos los demás.
 * Está anotado como fuera de scope en la tarea.
 */
export const menuOptionGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Cada grupo de opciones necesita un nombre.')
      .refine(
        (name) => !esNombreDeTamano(name),
        'Los tamaños se capturan arriba, en Tamaños, no como grupo de opciones. Si no es un tamaño, ponle otro nombre.',
      ),
    required: z.boolean(),
    // `maxMode` es la respuesta que da el formulario; `maxSelect` sólo se mira
    // cuando esa respuesta es 'hasta'. Llega como string por lo mismo que
    // `price_delta`: es lo que hay en un `<input>`, y mientras se teclea pasa
    // por estados que no son un número válido.
    maxMode: z.enum(['una', 'hasta', 'todas'], { message: 'Falta decir cuántas puede elegir.' }),
    maxSelect: z.string().trim(),
    options: optionsSchema,
  })
  .superRefine((group, ctx) => {
    const etiqueta = group.name.trim() || 'sin nombre'

    // El número sólo se exige cuando la respuesta fue "hasta…"; en los otros dos
    // modos el campo ni se muestra y lo que traiga es irrelevante.
    if (group.maxMode === 'hasta') {
      if (!/^\d+$/.test(group.maxSelect)) {
        ctx.addIssue({
          code: 'custom',
          message: `En "${etiqueta}" falta decir hasta cuántas opciones puede elegir.`,
        })
      } else if (Number(group.maxSelect) < 1) {
        ctx.addIssue({
          code: 'custom',
          message: `En "${etiqueta}" tiene que poder elegir al menos una.`,
        })
      } else if (Number(group.maxSelect) > 30) {
        ctx.addIssue({ code: 'custom', message: `El máximo de "${etiqueta}" es demasiado grande.` })
      }
    }

    // Un grupo obligatorio y vacío se guarda sin ruido en la DB (a propósito:
    // mientras se captura es legítimo) y el síntoma sale hasta el carrito, donde
    // el platillo queda imposible de pedir. Acá es donde se corta.
    if (group.required && group.options.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: `El grupo "${etiqueta}" es obligatorio, así que necesita al menos una opción.`,
      })
    }

    // El tope sólo se compara contra las opciones cuando hay opciones. Sin este
    // guard, un grupo OPCIONAL a medio capturar pasaba o rebotaba según un chip
    // que no viene al caso: "opcional / las que quiera / sin opciones" se
    // guardaba y "opcional / solo una / sin opciones" no, con un mensaje que
    // hablaba del máximo en vez de las opciones que faltan. El grupo opcional
    // vacío es aceptable —quien lo lee lo ignora en vez de bloquear el
    // platillo—; el obligatorio vacío lo corta el refine de arriba.
    const tope = maxSelectDe(group)
    if (group.options.length > 0 && tope !== null && tope > group.options.length) {
      ctx.addIssue({
        code: 'custom',
        message: `En "${etiqueta}" dejas elegir hasta ${tope}, pero sólo hay ${group.options.length} ${group.options.length === 1 ? 'opción' : 'opciones'}.`,
      })
    }

    const repetida = firstDuplicate(group.options.map((o) => o.name))
    if (repetida) {
      ctx.addIssue({
        code: 'custom',
        message: `En "${etiqueta}" hay dos opciones que se llaman "${repetida}".`,
      })
    }
  })
export type MenuOptionGroupInput = z.infer<typeof menuOptionGroupSchema>

/**
 * El orden del array ES el `order_index`, igual que en tamaños y fotos.
 *
 * La unicidad de nombre se valida acá y NO en la base: la migración
 * 20260916160000 quitó los índices únicos justo para que intercambiar los
 * nombres de dos grupos en un guardado no reviente a media escritura. El precio
 * de moverla es que hay que decir cuál se repite — que es, de todas formas, lo
 * que un índice único nunca pudo decir.
 */
export const menuOptionGroupsSchema = z
  .array(menuOptionGroupSchema, { message: 'Grupos de opciones inválidos.' })
  .max(20, 'Demasiados grupos de opciones para un solo platillo.')
  .superRefine((groups, ctx) => {
    const repetido = firstDuplicate(groups.map((g) => g.name))
    if (repetido) {
      ctx.addIssue({
        code: 'custom',
        message: `Hay dos grupos de opciones que se llaman "${repetido}".`,
      })
    }
  })

/** Lo que el formulario captura -> lo que tienen las columnas. Ver `menuOptionGroupSchema`. */
export function toOptionGroupRow(group: MenuOptionGroupInput): {
  min_select: number
  max_select: number | null
} {
  return { min_select: group.required ? 1 : 0, max_select: maxSelectDe(group) }
}

// Los campos que el editor de menú puede escribir. `order_index` NO está a
// propósito: el orden se mueve con `moveMenuItem` (intercambio entre dos filas),
// nunca mandando un número desde el cliente — un índice tecleado desde la UI es
// justo cómo se vuelve a caer en renumerar el catálogo entero.
const menuItemFields = {
  name: z.string().trim().min(1, 'El platillo necesita un nombre.'),
  price: priceSchema,
  description: z
    .string()
    .trim()
    .default('')
    .transform((v) => v || null),
  // Texto libre. La ortografía final la decide el server
  // (`canonicalSection` en actions.ts), no la UI.
  section: z
    .string()
    .trim()
    .default('')
    .transform((v) => v || null),
  // URL pública que devolvió `uploadBusinessPhoto` desde el cliente. null =
  // sin foto. En el patch, la CLAVE AUSENTE significa "no toques la foto";
  // null explícito significa "quítala". Ver `updateMenuItem`.
  image_url: z.string().trim().url('URL de foto inválida.').nullable().default(null),
  // Oculta el ítem de las DOS superficies (menú de mesa y perfil).
  is_published: z.boolean().default(true),
  // 2º eje: filtra SOLO el perfil (Flutter). El menú de mesa muestra todo lo
  // publicado y es su superconjunto por diseño — no invertir la semántica.
  show_in_profile: z.boolean().default(true),
  // Tamaños del platillo. Array vacío = precio único, que es el caso de casi
  // todo el catálogo. Cuando hay variantes, `price` deja de ser "el precio" y
  // pasa a ser el menor de ellas, o sea el "desde" que se pinta en las tres
  // superficies; el server lo recalcula, no se confía al cliente.
  variants: menuVariantsSchema.default([]),
  // Lo que el cliente elige además del tamaño. Vacío es el caso de casi todo el
  // catálogo; no afecta `price`, porque un extra SUMA en la línea del pedido y
  // no puede mover el "desde" que anuncia la card del menú.
  option_groups: menuOptionGroupsSchema.default([]),
}

export const menuItemCreateSchema = z.object(menuItemFields)
export type MenuItemCreateInput = z.infer<typeof menuItemCreateSchema>

/**
 * El patch se declara APARTE y SIN defaults. No es duplicación por descuido.
 *
 * `z.object(menuItemFields).partial()` parecía lo mismo y no lo era: en Zod 4
 * `.partial()` vuelve la clave opcional, pero el `.default()` de adentro se
 * sigue aplicando cuando la clave viene ausente. O sea que un patch de
 * `{name}` llegaba a `updateMenuItem` como
 * `{name, image_url: null, is_published: true, show_in_profile: true}`, y esa
 * action decide QUÉ tocar con `'image_url' in parsed.data`. Resultado: cada
 * "Guardar" del formulario borraba la foto del ítem (y el archivo del bucket,
 * vía `removeStoredPhoto`) y republicaba lo que estuviera oculto.
 *
 * La regla que sostiene a `updateMenuItem`: **clave ausente = no lo toques**.
 * Un default la vuelve presente, así que acá no puede haber ninguno.
 */
export const menuItemPatchSchema = z
  .object({
    name: z.string().trim().min(1, 'El platillo necesita un nombre.'),
    price: priceSchema,
    description: z
      .string()
      .trim()
      .transform((v) => v || null),
    section: z
      .string()
      .trim()
      .transform((v) => v || null),
    // null explícito = "quítala". Ver `updateMenuItem`.
    image_url: z.string().trim().url('URL de foto inválida.').nullable(),
    is_published: z.boolean(),
    show_in_profile: z.boolean(),
    // Clave ausente = no toques los tamaños. Array vacío = quítalos todos.
    variants: menuVariantsSchema,
    // Mismo contrato de tres estados que los tamaños, y por el mismo motivo:
    // sin `.default()`, o la clave ausente dejaría de significar "no lo toques"
    // y cada guardado borraría los grupos de quien no los editó.
    option_groups: menuOptionGroupsSchema,
  })
  .partial()
export type MenuItemPatchInput = z.infer<typeof menuItemPatchSchema>

// Los toggles de un bit escriben al toque (no esperan al botón de guardar):
// no pueden dejar una fila a medias porque no tocan `name`, que es NOT NULL.
export const menuItemVisibilitySchema = z
  .object({
    is_published: z.boolean().optional(),
    show_in_profile: z.boolean().optional(),
  })
  .refine(
    (v) => v.is_published !== undefined || v.show_in_profile !== undefined,
    'No se indicó qué visibilidad cambiar.',
  )

export const menuMoveSchema = z.enum(['up', 'down'], { message: 'Dirección inválida.' })
export type MenuMoveDirection = z.infer<typeof menuMoveSchema>
