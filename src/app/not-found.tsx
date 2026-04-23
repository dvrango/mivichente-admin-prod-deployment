import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">No encontrado</h2>
      <p className="text-muted-foreground text-sm">La página que buscas no existe.</p>
      <Link href="/businesses" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Volver al inicio
      </Link>
    </main>
  )
}
