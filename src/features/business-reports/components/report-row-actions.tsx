'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { dismissReport } from '../actions'
import type { BusinessReport } from '../types'

export function ReportRowActions({ report }: { report: BusinessReport }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleDismiss() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', report.id)
      const result = await dismissReport({ error: null }, fd)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDismiss} disabled={pending}>
      Descartar
    </Button>
  )
}
