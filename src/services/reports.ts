import { supabase } from '../lib/supabase'
import type { ReportReceipt, Urgency } from '../types/report'

export type CreateReportInput = {
  requestId: string
  turnstileToken: string
  citySlug: string
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
): Promise<ReportReceipt> {
  const { data, error } = await supabase.functions.invoke('submit-report', {
    body: {
      requestId: input.requestId,
      turnstileToken: input.turnstileToken,
      citySlug: input.citySlug,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId ?? null,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      urgency: input.urgency,
    },
  })

  if (
    error ||
    !data ||
    typeof data.trackingCode !== 'string' ||
    typeof data.createdAt !== 'string' ||
    data.status !== 'received'
  ) {
    throw new Error('No se pudo crear el reporte.')
  }

  return {
    trackingCode: data.trackingCode,
    createdAt: data.createdAt,
    status: 'received',
  }
}
