import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke } },
}))

import { createReport } from './reports'

const input = {
  requestId: '20000000-0000-4000-8000-000000000001',
  turnstileToken: 'test-token',
  citySlug: 'posadas',
  categoryId: '30000000-0000-4000-8000-000000000001',
  subcategoryId: null,
  description: 'Descripción válida del problema',
  latitude: -27.36,
  longitude: -55.90,
  urgency: 'medium' as const,
}

describe('createReport', () => {
  beforeEach(() => invoke.mockReset())

  it('invokes only the Edge Function and returns the limited receipt', async () => {
    invoke.mockResolvedValue({
      data: {
        trackingCode: 'PR-0123456789ABCDEF0123',
        createdAt: '2026-08-06T00:00:00.000Z',
        status: 'received',
      },
      error: null,
    })

    await expect(createReport(input)).resolves.toEqual({
      trackingCode: 'PR-0123456789ABCDEF0123',
      createdAt: '2026-08-06T00:00:00.000Z',
      status: 'received',
    })
    expect(invoke).toHaveBeenCalledWith('submit-report', {
      body: {
        requestId: input.requestId,
        turnstileToken: input.turnstileToken,
        citySlug: input.citySlug,
        categoryId: input.categoryId,
        subcategoryId: null,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        urgency: input.urgency,
      },
    })
  })

  it('rejects malformed or expanded responses', async () => {
    invoke.mockResolvedValue({
      data: { trackingCode: 'PR-INVALID', report: { description: 'sensitive' } },
      error: null,
    })
    await expect(createReport(input)).rejects.toThrow('No se pudo crear el reporte.')
  })
})
