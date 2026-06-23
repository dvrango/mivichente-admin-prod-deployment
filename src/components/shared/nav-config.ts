import { Store, Tags, ClipboardList, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
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
      { label: 'Categorías', href: '/categories', icon: Tags },
    ],
  },
  {
    label: 'Solicitudes',
    items: [{ label: 'Solicitudes', href: '/registrations', icon: ClipboardList }],
  },
]
