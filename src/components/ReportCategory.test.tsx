import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCategories, getSubcategories } = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getSubcategories: vi.fn(),
}))

vi.mock('../services/categories', () => ({ getCategories }))
vi.mock('../services/subcategories', () => ({ getSubcategories }))

import ReportCategory from './ReportCategory'

const category = {
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Baches',
  description: 'Problemas en la calzada',
  icon: '🕳️',
  is_active: true,
  created_at: '2026-08-06T00:00:00.000Z',
}

const subcategory = {
  id: '40000000-0000-4000-8000-000000000001',
  category_id: category.id,
  name: 'Bache en calzada',
  description: 'Rotura sobre una calle transitable',
  is_active: true,
  created_at: '2026-08-06T00:00:00.000Z',
}

describe('ReportCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCategories.mockResolvedValue([category])
    getSubcategories.mockResolvedValue([subcategory])
  })

  it('continues with the active subcategory selected by the user', async () => {
    const onContinue = vi.fn()
    render(
      <ReportCategory
        initialCategory={null}
        initialSubcategory={null}
        onContinue={onContinue}
        onBack={vi.fn()}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /Baches/ }))
    fireEvent.click(await screen.findByLabelText(/Bache en calzada/))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar →' }))

    expect(getSubcategories).toHaveBeenCalledWith(category.id)
    expect(onContinue).toHaveBeenCalledWith(category, subcategory)
  })

  it('allows continuing without a subcategory when the optional catalog fails', async () => {
    getSubcategories.mockRejectedValue(new Error('network'))
    const onContinue = vi.fn()
    render(
      <ReportCategory
        initialCategory={null}
        initialSubcategory={null}
        onContinue={onContinue}
        onBack={vi.fn()}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /Baches/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/continuar sin especificarlo/i)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar →' }))

    expect(onContinue).toHaveBeenCalledWith(category, null)
  })

  it('preserves the selected subcategory when the user returns to this step', async () => {
    const onContinue = vi.fn()
    render(
      <ReportCategory
        initialCategory={category}
        initialSubcategory={subcategory}
        onContinue={onContinue}
        onBack={vi.fn()}
      />
    )

    expect(await screen.findByRole('radio', { name: /Bache en calzada/ }))
      .toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar →' }))

    expect(onContinue).toHaveBeenCalledWith(category, subcategory)
  })
})
