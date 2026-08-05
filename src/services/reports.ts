import { supabase } from '../lib/supabase'

export type CreateReportInput = {
  categoryId: string
  subcategoryId?: string | null
  description: string
  latitude: number
  longitude: number
  address?: string | null
  urgency: 'low' | 'medium' | 'high'
}

export async function createReport(
  input: CreateReportInput
) {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId ?? null,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address ?? null,
      urgency: input.urgency,
      status: 'pending',
    })
    .select('id, created_at, status')
    .single()

  if (error) {
    console.error('Error al crear el reporte:', error)

    throw new Error(
      `${error.message}${error.details ? ` — ${error.details}` : ''}`
    )
  }

  return data
}