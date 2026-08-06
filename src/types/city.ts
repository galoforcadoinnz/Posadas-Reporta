export type CityReportingBounds = {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

export type City = {
  id: string
  name: string
  slug: string
  isActive: boolean
  reportingBounds: CityReportingBounds | null
}
