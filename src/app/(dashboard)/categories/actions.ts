'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CategoryType } from '@/lib/types'

export type CategoryFormState = { error: string | null }

const VALID_TYPES: readonly CategoryType[] = ['food', 'business']

type Parsed =
  | { ok: true; data: { name: string; icon: string | null; type: CategoryType } }
  | { ok: false; error: string }

function readForm(formData: FormData): Parsed {
  const name = String(formData.get('name') ?? '').trim()
  const icon = String(formData.get('icon') ?? '').trim() || null
  const type = String(formData.get('type') ?? '') as CategoryType

  if (!name) return { ok: false, error: 'El nombre es requerido.' }
  if (!VALID_TYPES.includes(type)) return { ok: false, error: 'Tipo inválido.' }

  return { ok: true, data: { name, icon, type } }
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = readForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('categories').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/categories')
  redirect('/categories')
}

export async function updateCategory(
  id: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = readForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('categories').update(parsed.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/categories')
  revalidatePath(`/categories/${id}`)
  redirect('/categories')
}

export async function toggleCategoryActive(id: string, nextActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('categories').update({ is_active: nextActive }).eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/categories')
  revalidatePath(`/categories/${id}`)
}
