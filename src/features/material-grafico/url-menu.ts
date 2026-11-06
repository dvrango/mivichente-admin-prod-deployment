// La URL que va impresa. Vive aparte porque es la única parte de la pieza que
// no se puede corregir después: una vez que el papel está pegado en la mesa, un
// `src` mal escrito queda mal para siempre.
//
// Forma fijada en las tareas f0ay73c8p y 8py5jmbyw:
//   - slug y nunca UUID (mismo tamaño de hoja, un tercio menos de módulos)
//   - `src` = 'menu-qr' a secas, SIN el nombre del negocio: el negocio ya viaja
//     en la ruta y el servidor lo guarda en qr_scans.business_id
export const DOMINIO_PUBLICO = 'https://vichente.com'
export const SRC_MENU_QR = 'menu-qr'

export function urlMenuImpresa(slug: string): string {
  return `${DOMINIO_PUBLICO}/${slug}/menu?src=${SRC_MENU_QR}`
}

export const SRC_SELLOS_QR = 'sellos-qr'

/** El QR del mostrador de la tarjeta de sellos (tarea o3w5njyf0). Forma
 *  decidida por el usuario el 2026-11-03, mismo patrón que el menú y las
 *  opiniones: slug, ruta fija y `src` sin el nombre del negocio. La página la
 *  sirve la landing (`hnururkb2`); el canal lo mapea `qr_scan_channel_from_src`. */
export function urlSellosMostrador(slug: string): string {
  return `${DOMINIO_PUBLICO}/${slug}/sellos?src=${SRC_SELLOS_QR}`
}

/** El QR de una tarjeta física de cliente (tarea 0m4h4mjmm, PDF en e69q7q4fy).
 *  Forma decidida por el usuario el 2026-11-05: sin slug, sin «sellos» y sin
 *  `?src=`, para que la tarjeta impresa no quede atada a una mecánica ni a un
 *  nombre de negocio que puede cambiar. La página la sirve la landing
 *  (`hnururkb2`). El token es secreto al portador: va solo dentro del QR. */
export function urlTarjetaFisica(token: string): string {
  return `${DOMINIO_PUBLICO}/t/${encodeURIComponent(token)}`
}

/** El menú de mesa tal como lo abre el cliente, para revisarlo desde el admin.
 *  SIN `?src=`: la landing solo registra un scan cuando viene `src`, así que
 *  abrirlo desde aquí no ensucia los conteos del QR. */
export function urlMenuPublico(slug: string): string {
  return `${DOMINIO_PUBLICO}/${slug}/menu`
}

/** URL del perfil como se LEE en la tarjeta que el negocio comparte. Va sin
 *  `?src=` a propósito: nadie la escanea, alguien la teclea desde la foto, y
 *  cada carácter de más es una oportunidad de equivocarse. El costo es que ese
 *  tráfico no queda atribuido en qr_scans. */
export function urlPerfilLegible(slug: string): string {
  return `${DOMINIO_PUBLICO.replace('https://', '')}/${slug}`
}
