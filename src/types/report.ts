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

export type ReportDetailsDraft = {
  description: string
  photo: File | null
  urgency: Urgency
}

export type ReportDraft = ReportDetailsDraft & {
  location: ReportLocation | null
  category: Category | null
  subcategory: Subcategory | null
}
