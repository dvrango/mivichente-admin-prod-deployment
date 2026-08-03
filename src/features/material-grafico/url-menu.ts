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
