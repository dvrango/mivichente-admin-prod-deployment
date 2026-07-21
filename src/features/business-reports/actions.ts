'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ReportActionState = { error: string | null }

export async function dismissReport(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { error: 'ID inválido.' }

  const supabase = await createClient()
  const { error } = await supabase.from('business_reports').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/reports')
  return { error: null }
}
