import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Category, Subcategory } from '../types/category'
import { useReportDraft } from './useReportDraft'

const category: Category = {
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Baches',
  description: null,
  icon: '🕳️',
  is_active: true,
  created_at: '2026-08-06T00:00:00.000Z',
}

const subcategory: Subcategory = {
  id: '40000000-0000-4000-8000-000000000001',
  category_id: category.id,
  name: 'Bache en calzada',
  description: null,
  is_active: true,
  created_at: '2026-08-06T00:00:00.000Z',
}

describe('useReportDraft', () => {
  it('advances through valid steps and preserves the complete draft', () => {
    const { result } = renderHook(() => useReportDraft())

    act(() => result.current.selectLocation({
      latitude: -27.36,
      longitude: -55.90,
    }))
    act(() => result.current.selectCategory(category, subcategory))
    act(() => result.current.updateDetails({
      description: 'Descripción válida del problema',
      urgency: 'high',
    }))
    act(() => result.current.completeDetails())

    expect(result.current.reportStep).toBe('preview')
    expect(result.current.reportDraft).toMatchObject({
      category,
      subcategory,
      description: 'Descripción válida del problema',
      urgency: 'high',
    })
  })

  it('does not enter preview before the required data is complete', () => {
    const { result } = renderHook(() => useReportDraft())

    act(() => result.current.completeDetails())

    expect(result.current.reportStep).toBe('map')
  })

  it('preserves details while navigating backwards', () => {
    const { result } = renderHook(() => useReportDraft())

    act(() => result.current.selectLocation({
      latitude: -27.36,
      longitude: -55.90,
    }))
    act(() => result.current.selectCategory(category, null))
    act(() => result.current.updateDetails({
      description: 'Descripción que debe conservarse',
    }))
    act(() => result.current.backToCategory())
    act(() => result.current.backToMap())

    expect(result.current.reportStep).toBe('map')
    expect(result.current.reportDraft.description)
      .toBe('Descripción que debe conservarse')
  })

  it('only enters success with a complete report and resets afterwards', () => {
    const { result } = renderHook(() => useReportDraft())

    act(() => result.current.markSubmissionSucceeded())
    expect(result.current.reportStep).toBe('map')

    act(() => result.current.selectLocation({
      latitude: -27.36,
      longitude: -55.90,
    }))
    act(() => result.current.selectCategory(category, null))
    act(() => result.current.updateDetails({ description: 'Reporte válido' }))
    act(() => result.current.markSubmissionSucceeded())
    expect(result.current.reportStep).toBe('success')

    act(() => result.current.resetDraft())
    expect(result.current.reportStep).toBe('map')
    expect(result.current.reportDraft.category).toBeNull()
    expect(result.current.reportDraft.description).toBe('')
  })
})
