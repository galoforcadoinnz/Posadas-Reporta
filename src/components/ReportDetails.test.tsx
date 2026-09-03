import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as photoService from '../services/photos'
import ReportDetails from './ReportDetails'

const baseProps = {
  location: { latitude: -27.36, longitude: -55.90 },
  category: {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Baches',
    description: null,
    icon: '🕳️',
    is_active: true,
    created_at: '2026-08-06T00:00:00.000Z',
  },
  subcategory: null,
  details: {
    description: 'Descripción válida del problema',
    photo: null,
    urgency: 'medium' as const,
  },
  onContinue: vi.fn(),
  onBack: vi.fn(),
}

describe('ReportDetails photo validation', () => {
  it('rejects an unsupported image type before previewing it', async () => {
    const onChange = vi.fn()
    render(<ReportDetails {...baseProps} onChange={onChange} />)
    const file = new File(['svg'], 'unsafe.svg', { type: 'image/svg+xml' })

    fireEvent.change(screen.getByLabelText('📸 Agregar una fotografía'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/JPEG, PNG o WebP/i)
    expect(onChange).toHaveBeenCalledWith({ photo: null })
  })

  it('rejects a photo larger than 10 MB', async () => {
    const onChange = vi.fn()
    render(<ReportDetails {...baseProps} onChange={onChange} />)
    const file = new File(['photo'], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 })

    fireEvent.change(screen.getByLabelText('📸 Agregar una fotografía'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/10 MB/i)
    expect(onChange).toHaveBeenCalledWith({ photo: null })
  })

  it('stores only the normalized photo after processing completes', async () => {
    const normalizedPhoto = {
      file: new File(['webp'], 'report-photo.webp', { type: 'image/webp' }),
      sha256: 'a'.repeat(64),
      byteSize: 4,
      width: 800,
      height: 600,
      mimeType: 'image/webp' as const,
    }
    vi.spyOn(photoService, 'normalizeReportPhoto')
      .mockResolvedValue(normalizedPhoto)
    const onChange = vi.fn()
    render(<ReportDetails {...baseProps} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('📸 Agregar una fotografía'), {
      target: {
        files: [new File(['jpeg'], 'camera.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(screen.getByRole('status')).toHaveTextContent(/preparando/i)
    expect(screen.getByRole('button', { name: 'Ver resumen →' }))
      .toBeDisabled()
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({ photo: normalizedPhoto })
    })
  })
})
