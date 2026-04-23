'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseCategoryForm } from './schema'

export type CategoryFormState = { error: string | null }

function firstIssue(err: import('zod').ZodError): string {
  return err.issues[0]?.message ?? 'Datos inválidos.'
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = parseCategoryForm(formData)
  if (!parsed.success) return { error: firstIssue(parsed.error) }

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
  const parsed = parseCategoryForm(formData)
  if (!parsed.success) return { error: firstIssue(parsed.error) }

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
