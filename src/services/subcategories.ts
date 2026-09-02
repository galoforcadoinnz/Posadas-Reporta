import { supabase } from '../lib/supabase'
import type { Subcategory } from '../types/category'

export async function getSubcategories(
  categoryId: string
): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from('subcategories')
    .select('id, category_id, name, description, is_active, created_at')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw new Error('No se pudieron obtener las subcategorías.')
  }

  return data ?? []
}
