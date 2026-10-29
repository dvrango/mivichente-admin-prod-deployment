import { DOMINIO_PUBLICO, urlMenuPublico } from '@/features/material-grafico/url-menu'

/**
 * Links públicos que el dueño puede compartir, con qué hace cada uno.
 *
 * Punto ciego aceptado: `ownerMenuUrl` va sin `src`, así que un QR que el dueño
 * haga por su cuenta con ese link no registra escaneos, y en las métricas del QR
 * de mesa (canal `menu-qr`) ese negocio sale con 0. Ponerle `src` contaría
 * también cada vez que el link se comparte suelto.
 *
 * Ninguno lleva `?src=`: la landing registra un scan en `qr_scans` cuando viene
 * `src`, y un link copiado del panel no es un scan. Mismo criterio que
 * `urlMenuPublico`.
 *
 * Fuera a propósito:
 * - `/<slug>/menu`: es el destino del QR de mesa, no un link para compartir. Se
 *   menciona en la tarjeta del QR (`ownerMenuUrl`), para el dueño que haga sus
 *   propios QR.
 * - `/app`: es la entrada general a Vichente, no un link del negocio.
 * - `/<slug>/opinion`: solo sirve en los negocios del piloto de opiniones, y el
 *   snapshot del dueño no dice si el suyo lo está.
 */

export type OwnerLink = {
  key: 'ordenar' | 'pagina'
  title: string
  url: string
  /** Para qué sirve, en una línea. */
  purpose: string
  /** Cómo usarlo: dónde ponerlo o cuándo mandarlo. */
  howTo: string
  /** El que más conviene compartir: se pinta destacado. */
  featured?: boolean
}

function isPublished(business: { slug: string | null; is_active: boolean }): business is {
  slug: string
  is_active: true
} {
  // Sin publicar o sin slug, la landing responde 404: mejor no dar links.
  return business.is_active && !!business.slug
}

export function ownerLinks(
  business: { slug: string | null; is_active: boolean },
  opts: {
    hasServices: boolean
    /** `undefined` cuando el snapshot todavía no trae `accepts_orders`. */
    acceptsOrders?: boolean
  },
): OwnerLink[] {
  if (!isPublished(business)) return []
  const slug = business.slug
  const url = `${DOMINIO_PUBLICO}/${slug}/ordenar`

  return [ordenarLink(url, opts), paginaLink(slug)]
}

function ordenarLink(
  url: string,
  { hasServices, acceptsOrders }: { hasServices: boolean; acceptsOrders?: boolean },
): OwnerLink {
  // Sin nada capturado no hay precios que ver ni nada que pedir: el link sirve,
  // pero no es el que conviene mandar cuando preguntan por el menú.
  if (!hasServices) {
    return {
      key: 'ordenar',
      title: 'Tu negocio en la app',
      url,
      purpose: 'Abre tu negocio directo en la app de Vichente.',
      howTo:
        'Cuando capturemos lo que ofreces con sus precios, este será el link para mandar cuando te pregunten «¿me mandas el menú?». Escríbenos para capturarlo.',
    }
  }
  if (acceptsOrders === false) {
    return {
      key: 'ordenar',
      title: 'Tu menú en la app',
      url,
      purpose:
        'Abre tu negocio directo en la app de Vichente, con tus precios. Todavía no tienes los pedidos activados: tu cliente ve lo que ofreces y te llama o te escribe.',
      howTo:
        'Mándalo cuando te pregunten «¿me mandas el menú?» y ponlo en tus estados de WhatsApp. Si quieres que te pidan desde ahí, escríbenos para activar los pedidos.',
      featured: true,
    }
  }
  return {
    key: 'ordenar',
    title: 'Tu link para que te pidan',
    url,
    // Sin el dato (la función de prod todavía no lo trae), el texto tiene que
    // ser cierto con y sin pedidos activados.
    purpose:
      acceptsOrders === true
        ? 'Abre tu negocio directo en la app de Vichente. Ahí tu cliente ve tus precios, arma su pedido y te llega a tu WhatsApp ya escrito.'
        : 'Abre tu negocio directo en la app de Vichente, con tus precios. Si tienes los pedidos activados, ahí mismo tu cliente arma su pedido y te llega a tu WhatsApp ya escrito.',
    howTo:
      'Es el link más importante para compartir. Mándalo cuando te pregunten «¿me mandas el menú?» o «¿qué tienes?», y ponlo en tus estados de WhatsApp.',
    featured: true,
  }
}

function paginaLink(slug: string): OwnerLink {
  return {
    key: 'pagina',
    title: 'Tu página en Vichente',
    url: `${DOMINIO_PUBLICO}/${slug}`,
    purpose:
      'Tu ficha con tus datos, horario, ubicación y botones para llamarte o escribirte. Se abre en cualquier celular, sin instalar nada.',
    howTo:
      'Ponla en la bio de tu Instagram y Facebook, o mándala cuando alguien te pregunte dónde estás o a qué hora abres.',
  }
}

/**
 * El link que abre el QR de mesa. Sin nada capturado no hay menú que mostrar,
 * y sin publicar la landing daría 404.
 */
export function ownerMenuUrl(
  business: { slug: string | null; is_active: boolean },
  hasServices: boolean,
): string | null {
  if (!isPublished(business) || !hasServices) return null
  return urlMenuPublico(business.slug)
}
