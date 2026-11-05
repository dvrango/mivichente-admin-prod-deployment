import { z } from 'zod'

/** Generar una hoja solo necesita el negocio. Cuántas tarjetas lleva lo fija el
 *  servidor (`TARJETAS_POR_HOJA`), no el navegador. */
export const crearHojaSchema = z.object({
  businessId: z.string().uuid('Negocio inválido.'),
})

/** Lo que regresa `admin_create_physical_cards`: 18 bytes en base64url. */
export const TOKEN_FISICA = /^[A-Za-z0-9_-]{24}$/
