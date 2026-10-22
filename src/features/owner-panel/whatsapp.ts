/**
 * Links de WhatsApp del panel del dueño. Todos llegan al número de Vichente.
 *
 * Cada mensaje dice de qué sección sale: un dueño que pide "opiniones" o
 * "actividad" está diciendo qué función le interesa, y esa es la señal que el
 * panel existe para juntar. Sin el tema en el texto habría que preguntarle.
 */

/** WhatsApp de Vichente, 10 dígitos. No es secreto: es el número de contacto. */
export const VICHENTE_WHATSAPP = '6751108948'

export type OwnerWhatsappTopic = 'cambio' | 'opiniones' | 'actividad'

export function ownerWhatsappMessage(businessName: string, topic: OwnerWhatsappTopic): string {
  const saludo = `Hola, soy de ${businessName.trim()}.`
  switch (topic) {
    case 'cambio':
      return `${saludo} Quiero cambiar algo de mi negocio en Vichente: `
    case 'opiniones':
      return `${saludo} Me interesa: opiniones de mis clientes en Vichente.`
    case 'actividad':
      return `${saludo} Me interesa: saber cuánta gente busca mi negocio en Vichente.`
  }
}

/** Link al WhatsApp de Vichente; sin `text`, el chat abre vacío. */
export function vichenteWhatsappLink(text?: string): string {
  const base = `https://wa.me/52${VICHENTE_WHATSAPP}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function ownerWhatsappLink(businessName: string, topic: OwnerWhatsappTopic): string {
  return vichenteWhatsappLink(ownerWhatsappMessage(businessName, topic))
}
