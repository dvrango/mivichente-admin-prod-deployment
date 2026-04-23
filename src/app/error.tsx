'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Algo falló</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset} variant="outline" size="sm">
        Reintentar
      </Button>
    </main>
  )
}
