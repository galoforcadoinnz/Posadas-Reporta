import { describe, expect, it, vi } from 'vitest'
import {
  MAX_INPUT_PHOTO_BYTES,
  MAX_OUTPUT_PHOTO_BYTES,
  normalizeReportPhoto,
  PhotoNormalizationError,
  sha256Blob,
  type PhotoProcessingAdapter,
} from './photos'

function createAdapter(
  encode: PhotoProcessingAdapter['encode'] = vi.fn().mockResolvedValue(
    new Blob(['normalized'], { type: 'image/webp' })
  )
): PhotoProcessingAdapter {
  return {
    decode: vi.fn().mockResolvedValue({
      source: {} as CanvasImageSource,
      width: 3200,
      height: 1600,
      close: vi.fn(),
    }),
    encode,
    sha256: vi.fn().mockResolvedValue('a'.repeat(64)),
  }
}

describe('normalizeReportPhoto', () => {
  it('calculates the standard lowercase SHA-256 representation', async () => {
    await expect(sha256Blob(new Blob(['abc']))).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('rejects unsupported input before decoding it', async () => {
    const adapter = createAdapter()
    const file = new File(['svg'], 'unsafe.svg', { type: 'image/svg+xml' })

    await expect(normalizeReportPhoto(file, adapter)).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    })
    expect(adapter.decode).not.toHaveBeenCalled()
  })

  it('rejects an oversized input before decoding it', async () => {
    const adapter = createAdapter()
    const file = new File(['photo'], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: MAX_INPUT_PHOTO_BYTES + 1 })

    await expect(normalizeReportPhoto(file, adapter)).rejects.toMatchObject({
      code: 'INPUT_TOO_LARGE',
    })
    expect(adapter.decode).not.toHaveBeenCalled()
  })

  it('resizes, retries encoding and returns only normalized metadata', async () => {
    const encode = vi.fn()
      .mockResolvedValueOnce(new Blob(
        [new Uint8Array(MAX_OUTPUT_PHOTO_BYTES + 1)],
        { type: 'image/webp' }
      ))
      .mockResolvedValueOnce(new Blob(['normalized'], { type: 'image/webp' }))
    const adapter = createAdapter(encode)
    const decoded = await adapter.decode(new File([], 'unused.webp'))
    vi.mocked(adapter.decode).mockResolvedValue(decoded)

    const result = await normalizeReportPhoto(
      new File(['jpeg'], 'camera-name.jpg', { type: 'image/jpeg' }),
      adapter
    )

    expect(encode).toHaveBeenNthCalledWith(
      1,
      decoded.source,
      1600,
      800,
      0.82
    )
    expect(encode).toHaveBeenNthCalledWith(
      2,
      decoded.source,
      1600,
      800,
      0.72
    )
    expect(result).toMatchObject({
      sha256: 'a'.repeat(64),
      width: 1600,
      height: 800,
      mimeType: 'image/webp',
    })
    expect(result.file.name).toBe('report-photo.webp')
    expect(result.file.type).toBe('image/webp')
    expect(decoded.close).toHaveBeenCalledOnce()
  })

  it('rejects images with excessive decoded dimensions', async () => {
    const adapter = createAdapter()
    vi.mocked(adapter.decode).mockResolvedValue({
      source: {} as CanvasImageSource,
      width: 5000,
      height: 3000,
      close: vi.fn(),
    })

    await expect(normalizeReportPhoto(
      new File(['jpeg'], 'large.jpg', { type: 'image/jpeg' }),
      adapter
    )).rejects.toBeInstanceOf(PhotoNormalizationError)
    expect(adapter.encode).not.toHaveBeenCalled()
  })

  it('fails closed when every normalized result remains too large', async () => {
    const adapter = createAdapter(vi.fn().mockResolvedValue(new Blob(
      [new Uint8Array(MAX_OUTPUT_PHOTO_BYTES + 1)],
      { type: 'image/webp' }
    )))

    await expect(normalizeReportPhoto(
      new File(['jpeg'], 'large.jpg', { type: 'image/jpeg' }),
      adapter
    )).rejects.toMatchObject({ code: 'OUTPUT_TOO_LARGE' })
    expect(adapter.encode).toHaveBeenCalledTimes(4)
  })
})
