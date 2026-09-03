import type { Category, Subcategory } from './category'

export type Urgency = 'low' | 'medium' | 'high'

export type ReportLocation = {
  latitude: number
  longitude: number
}

export type ReportStep =
  | 'map'
  | 'category'
  | 'details'
  | 'preview'
  | 'success'

export type ReportReceipt = {
  trackingCode: string
  createdAt: string
  status: 'received'
}

export type ReportPhotoDraft = {
  file: File
  sha256: string
  byteSize: number
  width: number
  height: number
  mimeType: 'image/webp'
}

export type ReportDetailsDraft = {
  description: string
  photo: ReportPhotoDraft | null
  urgency: Urgency
}

export type ReportDraft = ReportDetailsDraft & {
  location: ReportLocation | null
  category: Category | null
  subcategory: Subcategory | null
}
