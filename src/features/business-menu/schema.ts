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
