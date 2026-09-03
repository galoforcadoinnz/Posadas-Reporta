import type { ReportPhotoDraft } from '../types/report'

export const MAX_INPUT_PHOTO_BYTES = 10 * 1024 * 1024
export const MAX_OUTPUT_PHOTO_BYTES = 2 * 1024 * 1024
export const MAX_PHOTO_DIMENSION = 1600
export const MAX_PHOTO_PIXELS = 12_000_000

const OUTPUT_MIME_TYPE = 'image/webp' as const
const OUTPUT_QUALITIES = [0.82, 0.72, 0.62, 0.52] as const
const ALLOWED_INPUT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export type PhotoNormalizationErrorCode =
  | 'UNSUPPORTED_TYPE'
  | 'INPUT_TOO_LARGE'
  | 'INVALID_DIMENSIONS'
  | 'DECODE_FAILED'
  | 'ENCODE_FAILED'
  | 'OUTPUT_TOO_LARGE'

export class PhotoNormalizationError extends Error {
  readonly code: PhotoNormalizationErrorCode

  constructor(code: PhotoNormalizationErrorCode) {
    super(code)
    this.code = code
  }
}

type DecodedPhoto = {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

export type PhotoProcessingAdapter = {
  decode: (file: File) => Promise<DecodedPhoto>
  encode: (
    source: CanvasImageSource,
    width: number,
    height: number,
    quality: number
  ) => Promise<Blob>
  sha256: (blob: Blob) => Promise<string>
}

function targetDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(width, height))

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function validDimensions(width: number, height: number) {
  return Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width * height <= MAX_PHOTO_PIXELS
}

async function decodePhoto(file: File): Promise<DecodedPhoto> {
  let image: ImageBitmap

  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoNormalizationError('DECODE_FAILED')
  }

  return {
    source: image,
    width: image.width,
    height: image.height,
    close: () => image.close(),
  }
}

function encodeWebp(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })

  if (!context) {
    return Promise.reject(new PhotoNormalizationError('ENCODE_FAILED'))
  }

  context.drawImage(source, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== OUTPUT_MIME_TYPE) {
        reject(new PhotoNormalizationError('ENCODE_FAILED'))
        return
      }
      resolve(blob)
    }, OUTPUT_MIME_TYPE, quality)
  })
}

export async function sha256Blob(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const browserPhotoProcessingAdapter: PhotoProcessingAdapter = {
  decode: decodePhoto,
  encode: encodeWebp,
  sha256: sha256Blob,
}

export async function normalizeReportPhoto(
  file: File,
  adapter: PhotoProcessingAdapter = browserPhotoProcessingAdapter
): Promise<ReportPhotoDraft> {
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    throw new PhotoNormalizationError('UNSUPPORTED_TYPE')
  }

  if (file.size > MAX_INPUT_PHOTO_BYTES) {
    throw new PhotoNormalizationError('INPUT_TOO_LARGE')
  }

  const decoded = await adapter.decode(file)

  try {
    if (!validDimensions(decoded.width, decoded.height)) {
      throw new PhotoNormalizationError('INVALID_DIMENSIONS')
    }

    const dimensions = targetDimensions(decoded.width, decoded.height)
    let normalizedBlob: Blob | null = null

    for (const quality of OUTPUT_QUALITIES) {
      const candidate = await adapter.encode(
        decoded.source,
        dimensions.width,
        dimensions.height,
        quality
      )

      if (candidate.type !== OUTPUT_MIME_TYPE) {
        throw new PhotoNormalizationError('ENCODE_FAILED')
      }

      if (candidate.size <= MAX_OUTPUT_PHOTO_BYTES) {
        normalizedBlob = candidate
        break
      }
    }

    if (!normalizedBlob) {
      throw new PhotoNormalizationError('OUTPUT_TOO_LARGE')
    }

    const normalizedFile = new File(
      [normalizedBlob],
      'report-photo.webp',
      { type: OUTPUT_MIME_TYPE }
    )

    return {
      file: normalizedFile,
      sha256: await adapter.sha256(normalizedBlob),
      byteSize: normalizedBlob.size,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: OUTPUT_MIME_TYPE,
    }
  } finally {
    decoded.close()
  }
}
