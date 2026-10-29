import { DOMINIO_PUBLICO, urlMenuPublico } from '@/features/material-grafico/url-menu'

/**
 * Links públicos que el dueño puede compartir, con qué hace cada uno.
 *
 * Ninguno lleva `?src=`: la landing registra un scan en `qr_scans` cuando viene
 * `src`, y un link copiado del panel no es un scan. Mismo criterio que
 * `urlMenuPublico`.
 *
 * Fuera a propósito: `/<slug>/opinion`. Solo sirve en los negocios del piloto de
 * opiniones, y el snapshot del dueño no dice si el suyo lo está.
 */

export type OwnerLink = {
  key: 'pagina' | 'menu' | 'app-negocio' | 'app-descarga'
  title: string
  url: string
  /** Para qué sirve, en una línea. */
  purpose: string
  /** Cómo usarlo: dónde ponerlo o cuándo mandarlo. */
  howTo: string
}

export function ownerLinks(
  business: { slug: string | null; is_active: boolean },
  opts: { servicesLabel: string; hasServices: boolean },
): OwnerLink[] {
  // Sin publicar o sin slug, la landing responde 404: mejor no dar links.
  if (!business.is_active || !business.slug) return []
  const slug = business.slug

  const links: OwnerLink[] = [
    {
      key: 'pagina',
      title: 'Tu página en Vichente',
      url: `${DOMINIO_PUBLICO}/${slug}`,
      purpose:
        'Tu ficha con tus datos, horario, ubicación y botones para llamarte o escribirte. Se abre en cualquier celular, sin instalar nada.',
      howTo:
        'Ponla en la bio de tu Instagram y Facebook, o mándala cuando alguien te pregunte dónde estás o a qué hora abres.',
    },
  ]

  if (opts.hasServices) {
    links.push({
      key: 'menu',
      // `services_label` es "Menú", "Productos", "Servicios"…: como título va
      // solo, porque "Tu productos" no concuerda.
      title: opts.servicesLabel,
      url: urlMenuPublico(slug),
      // Consultar y ordenar son usos distintos (guía «Preparar y entregar el menú
      // y los pedidos»): este es para ver, el de la app es para pedir.
      purpose:
        'Todo lo que ofreces, con precios, en una página que se abre directo en el navegador. Es para consultar, no para pedir.',
      howTo:
        'Es el mismo que abre el QR de mesa, si tienes uno. Úsalo para que lo vean en tu local o en tus redes.',
    })
  }

  links.push(
    {
      key: 'app-negocio',
      title: 'Tu negocio en la app',
      url: `${DOMINIO_PUBLICO}/${slug}/ordenar`,
      purpose:
        'Abre tu negocio dentro de la app de Vichente. Si tienes pedidos activados, ahí tu cliente arma su pedido y te llega por WhatsApp.',
      howTo:
        'Si tienes pedidos activados, mándalo cuando te pregunten «¿me mandas el menú?»: quien pregunta ya quiere pedir, y ahí lo arma solo.',
    },
    {
      key: 'app-descarga',
      title: 'Descargar Vichente',
      url: `${DOMINIO_PUBLICO}/app`,
      purpose: 'Manda a tus clientes a instalar Vichente, en Android o iPhone según su teléfono.',
      howTo: 'Compártelo para que te encuentren junto con los demás negocios del pueblo.',
    },
  )

  return links
}
