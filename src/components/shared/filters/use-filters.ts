'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function useFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function get(key: string): string | null {
    return searchParams.get(key)
  }

  function set(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value != null && value !== '') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function reset(keys: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of keys) params.delete(key)
    params.delete('page')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function hasAny(keys: string[]): boolean {
    return keys.some((k) => searchParams.has(k) && searchParams.get(k) !== '')
  }

  return { get, set, reset, hasAny, isPending }
}
