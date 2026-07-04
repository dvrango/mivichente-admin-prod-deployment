import { requireAdmin } from '@/features/auth/queries'

// Categorías es sólo-admin (el reviewer no gestiona el catálogo).
export default async function CategoriesLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
