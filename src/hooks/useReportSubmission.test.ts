import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createReport } = vi.hoisted(() => ({ createReport: vi.fn() }))

vi.mock('../services/reports', () => ({ createReport }))

import { useReportSubmission } from './useReportSubmission'

const input = {
  turnstileToken: 'first-token',
  citySlug: 'posadas',
  categoryId: '30000000-0000-4000-8000-000000000001',
  subcategoryId: null,
  description: 'Descripción válida del problema',
  latitude: -27.36,
  longitude: -55.90,
  urgency: 'medium' as const,
}

describe('useReportSubmission', () => {
  beforeEach(() => createReport.mockReset())

  it('keeps requestId for a retry but forces a fresh Turnstile widget', async () => {
    createReport
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        trackingCode: 'PR-0123456789ABCDEF0123',
        createdAt: '2026-08-06T00:00:00.000Z',
        status: 'received',
      })

    const { result } = renderHook(() => useReportSubmission())
    const initialGeneration = result.current.turnstileGeneration

    await act(() => result.current.submit(input))
    const firstRequestId = createReport.mock.calls[0][0].requestId
    expect(result.current.turnstileGeneration).toBe(initialGeneration + 1)

    await act(() => result.current.submit({ ...input, turnstileToken: 'second-token' }))
    expect(createReport.mock.calls[1][0].requestId).toBe(firstRequestId)
    expect(createReport.mock.calls[1][0].turnstileToken).toBe('second-token')
    expect(result.current.turnstileGeneration).toBe(initialGeneration + 2)
  })

  it('changes requestId when the report content is edited', async () => {
    createReport.mockResolvedValue({
      trackingCode: 'PR-0123456789ABCDEF0123',
      createdAt: '2026-08-06T00:00:00.000Z',
      status: 'received',
    })
    const { result } = renderHook(() => useReportSubmission())

    await act(() => result.current.submit(input))
    const firstRequestId = createReport.mock.calls[0][0].requestId
    act(() => result.current.invalidateRequest())
    await act(() => result.current.submit(input))

    expect(createReport.mock.calls[1][0].requestId).not.toBe(firstRequestId)
  })

  it('blocks a second submission while the first one is pending', async () => {
    let resolveFirst: ((value: {
      trackingCode: string
      createdAt: string
      status: 'received'
    }) => void) | undefined
    createReport.mockReturnValue(new Promise((resolve) => {
      resolveFirst = resolve
    }))
    const { result } = renderHook(() => useReportSubmission())

    let firstSubmission: ReturnType<typeof result.current.submit> | undefined
    let secondResult: Awaited<ReturnType<typeof result.current.submit>> | undefined
    await act(async () => {
      firstSubmission = result.current.submit(input)
      secondResult = await result.current.submit(input)
    })

    expect(secondResult).toBeNull()
    expect(createReport).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst?.({
        trackingCode: 'PR-0123456789ABCDEF0123',
        createdAt: '2026-08-06T00:00:00.000Z',
        status: 'received',
      })
      await firstSubmission
    })
  })
})
