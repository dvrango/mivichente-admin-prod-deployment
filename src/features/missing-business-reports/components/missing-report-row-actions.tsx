'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setMissingReportStatus } from '../actions'
import type { MissingReportStatus } from '../schema'
import type { MissingBusinessReport } from '../types'

export function MissingReportRowActions({ report }: { report: MissingBusinessReport }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function setStatus(status: MissingReportStatus) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', report.id)
      fd.set('status', status)
      const result = await setMissingReportStatus({ error: null }, fd)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  // Un aviso ya revisado se puede reabrir: marcar por error no debe dejarlo
  // escondido para siempre en otra pestaña.
  if (report.status !== 'pending') {
    return (
      <Button variant="ghost" size="sm" onClick={() => setStatus('pending')} disabled={pending}>
        Reabrir
      </Button>
    )
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="outline" size="sm" onClick={() => setStatus('resolved')} disabled={pending}>
        Atendido
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setStatus('dismissed')} disabled={pending}>
        Descartar
      </Button>
    </div>
  )
}
