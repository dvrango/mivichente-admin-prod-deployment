'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function OwnerError({
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">No pudimos cargar tu negocio</h2>
      <p className="text-muted-foreground text-sm">Inténtalo otra vez en un momento.</p>
      <Button onClick={reset} variant="outline" size="sm">
        Reintentar
      </Button>
    </div>
  )
}
