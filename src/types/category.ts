export type Category = {
  id: string
  name: string
  description: string | null
  icon: string | null
  is_active: boolean
  created_at: string
}

export type Subcategory = {
  id: string
  category_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}
