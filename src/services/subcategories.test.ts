import { beforeEach, describe, expect, it, vi } from 'vitest'

const { eq, from, order, select } = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
}))

const query = { eq, order, select }

vi.mock('../lib/supabase', () => ({
  supabase: { from },
}))

import { getSubcategories } from './subcategories'

describe('getSubcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    from.mockReturnValue(query)
    select.mockReturnValue(query)
    eq.mockReturnValue(query)
  })

  it('loads only active subcategories for the selected category', async () => {
    const data = [{
      id: '40000000-0000-4000-8000-000000000001',
      category_id: '30000000-0000-4000-8000-000000000001',
      name: 'Bache en calzada',
      description: null,
      is_active: true,
      created_at: '2026-08-06T00:00:00.000Z',
    }]
    order.mockResolvedValue({ data, error: null })

    await expect(getSubcategories(data[0].category_id)).resolves.toEqual(data)
    expect(from).toHaveBeenCalledWith('subcategories')
    expect(select).toHaveBeenCalledWith(
      'id, category_id, name, description, is_active, created_at'
    )
    expect(eq).toHaveBeenNthCalledWith(1, 'category_id', data[0].category_id)
    expect(eq).toHaveBeenNthCalledWith(2, 'is_active', true)
    expect(order).toHaveBeenCalledWith('name')
  })

  it('returns a controlled error when the catalog query fails', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'private detail' } })

    await expect(getSubcategories('category-id')).rejects.toThrow(
      'No se pudieron obtener las subcategorías.'
    )
  })
})
