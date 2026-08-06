import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ReportSuccess from './ReportSuccess'

const receipt = {
  trackingCode: 'PR-0123456789ABCDEF0123',
  createdAt: '2026-08-06T00:00:00.000Z',
  status: 'received' as const,
}

describe('ReportSuccess', () => {
  it('shows the public receipt and starts another report', () => {
    const onCreateAnother = vi.fn()
    render(<ReportSuccess receipt={receipt} onCreateAnother={onCreateAnother} />)
    expect(screen.getByText(receipt.trackingCode)).toBeInTheDocument()
    expect(screen.getByText('Recibido')).toBeInTheDocument()
    expect(screen.queryByText(/moderation/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Crear otro reporte' }))
    expect(onCreateAnother).toHaveBeenCalledOnce()
  })

  it('copies only the tracking code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ReportSuccess receipt={receipt} onCreateAnother={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }))
    expect(writeText).toHaveBeenCalledWith(receipt.trackingCode)
    expect(await screen.findByText('Código copiado.')).toBeInTheDocument()
  })
})
