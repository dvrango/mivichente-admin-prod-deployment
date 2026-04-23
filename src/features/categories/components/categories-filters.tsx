import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import type { CategoryType } from '../types'

export function CategoriesFilters({ active }: { active: CategoryType | null }) {
  return (
    <div className="flex gap-2">
      <FilterLink label="Todas" href="/categories" active={active === null} />
      <FilterLink label="Comida" href="/categories?type=food" active={active === 'food'} />
      <FilterLink
        label="Negocios"
        href="/categories?type=business"
        active={active === 'business'}
      />
    </div>
  )
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' })}
    >
      {label}
    </Link>
  )
}
