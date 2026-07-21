import { Store, Tags, ClipboardList, Search, MapPin, Flag, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
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
    items: [{ label: 'Solicitudes', href: '/registrations', icon: ClipboardList, adminOnly: true }],
  },
  {
    label: 'Moderación',
    items: [{ label: 'Reportes', href: '/reports', icon: Flag }],
  },
  {
    label: 'Herramientas',
    items: [
      { label: 'Captura en campo', href: '/campo', icon: MapPin },
      { label: 'Simulador de búsqueda', href: '/search-preview', icon: Search },
    ],
  },
]

// Filtra grupos/items según rol: el reviewer sólo ve lo que no es adminOnly
// (grupos que quedan vacíos se descartan).
export function navGroupsForRole(role: 'admin' | 'reviewer'): NavGroup[] {
  if (role === 'admin') return navGroups
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly) }))
    .filter((group) => group.items.length > 0)
}
