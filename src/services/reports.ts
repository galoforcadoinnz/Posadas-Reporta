import { supabase } from '../lib/supabase'
import type { Urgency } from '../types/report'

export type CreateReportInput = {
  categoryId: string
  subcategoryId?: string | null
  description: string
  latitude: number
  longitude: number
  address?: string | null
  urgency: Urgency
}

export async function createReport(
  input: CreateReportInput
): Promise<void> {
  const { error } = await supabase
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

  if (error) {
    throw new Error('No se pudo crear el reporte.')
  }
}
