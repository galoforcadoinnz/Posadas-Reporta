import { supabase } from '../lib/supabase'
import type { Category } from '../types/category'

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, icon, is_active, created_at')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error al obtener categorías:', error)

    throw new Error(
      `${error.message}${error.details ? ` — ${error.details}` : ''}`
    )
  }

  return data ?? []
}