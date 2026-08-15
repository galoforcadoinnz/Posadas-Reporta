import { supabase } from '../lib/supabase'
import type { City } from '../types/city'

type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  reporting_min_latitude: number | null
  reporting_max_latitude: number | null
  reporting_min_longitude: number | null
  reporting_max_longitude: number | null
}

export async function getActiveCity(slug: string): Promise<City> {
  const { data, error } = await supabase
    .from('cities')
    .select(
      'id, name, slug, is_active, reporting_min_latitude, reporting_max_latitude, reporting_min_longitude, reporting_max_longitude'
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single<CityRow>()

  if (error || !data) {
    throw new Error('No se pudo obtener la configuración de la ciudad.')
  }

  const hasCompleteBounds =
    data.reporting_min_latitude !== null &&
    data.reporting_max_latitude !== null &&
    data.reporting_min_longitude !== null &&
    data.reporting_max_longitude !== null

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    isActive: data.is_active,
    reportingBounds: hasCompleteBounds
      ? {
          minLatitude: data.reporting_min_latitude as number,
          maxLatitude: data.reporting_max_latitude as number,
          minLongitude: data.reporting_min_longitude as number,
          maxLongitude: data.reporting_max_longitude as number,
        }
      : null,
  }
}
