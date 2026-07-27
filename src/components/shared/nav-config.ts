import { Store, Tags, ClipboardList, Search, MapPin, Flag, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  /** Etiqueta corta para la barra inferior de mobile (cabe en un quinto de pantalla). */
  shortLabel?: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export type NavGroup = {
  label: string | null
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Catálogo',
    items: [
      { label: 'Negocios', href: '/businesses', icon: Store },
      { label: 'Categorías', href: '/categories', icon: Tags, adminOnly: true },
    ],
  },
  {
    label: 'Solicitudes',
    items: [
      {
        label: 'Solicitudes',
        shortLabel: 'Registros',
        href: '/registrations',
        icon: ClipboardList,
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Moderación',
    items: [{ label: 'Reportes', href: '/reports', icon: Flag }],
  },
  {
    label: 'Herramientas',
    items: [
      { label: 'Captura en campo', shortLabel: 'Campo', href: '/campo', icon: MapPin },
      {
        label: 'Simulador de búsqueda',
        shortLabel: 'Simulador',
        href: '/search-preview',
        icon: Search,
      },
    ],
  },
]

// Orden de la barra inferior de mobile, por frecuencia real de uso en campaña:
// primero capturar, luego el catálogo, luego lo que llega solo. Lo que no cabe
// en los 4 slots se va al sheet de "Más".
const MOBILE_PRIMARY_HREFS = ['/campo', '/businesses', '/registrations', '/reports']

/**
 * Items de la barra inferior (`primary`) y del sheet de "Más" (`more`), ya
 * filtrados por rol. Un reviewer no ve /registrations ni /categories, así que su
 * barra queda con menos slots — se acomodan solos, no quedan huecos.
 */
export function mobileNavForRole(role: 'admin' | 'reviewer'): {
  primary: NavItem[]
  more: NavItem[]
} {
  const items = navGroupsForRole(role).flatMap((group) => group.items)
  const primary = MOBILE_PRIMARY_HREFS.map((href) => items.find((i) => i.href === href)).filter(
    (i): i is NavItem => i !== undefined,
  )
  const more = items.filter((i) => !MOBILE_PRIMARY_HREFS.includes(i.href))
  return { primary, more }
}

// Filtra grupos/items según rol: el reviewer sólo ve lo que no es adminOnly
// (grupos que quedan vacíos se descartan).
export function navGroupsForRole(role: 'admin' | 'reviewer'): NavGroup[] {
  if (role === 'admin') return navGroups
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly) }))
    .filter((group) => group.items.length > 0)
}
