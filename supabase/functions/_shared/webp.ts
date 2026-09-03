export const MAX_WEBP_BYTES = 2 * 1024 * 1024
export const MAX_WEBP_DIMENSION = 1600
export const MAX_WEBP_PIXELS = MAX_WEBP_DIMENSION * MAX_WEBP_DIMENSION

const MAX_RIFF_CHUNKS = 32
const textDecoder = new TextDecoder('ascii')

export type WebpInfo = {
  width: number
  height: number
  chunks: readonly string[]
}

export class WebpValidationError extends Error {
  constructor(readonly code: 'INVALID_WEBP' | 'WEBP_TOO_LARGE' | 'INVALID_DIMENSIONS') {
    super(code)
  }
}

function fourCc(bytes: Uint8Array, offset: number) {
  return textDecoder.decode(bytes.subarray(offset, offset + 4))
}

function readUint24(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function vp8Dimensions(payload: Uint8Array) {
  if (
    payload.length < 10 ||
    (payload[0] & 0x01) !== 0 ||
    payload[3] !== 0x9d ||
    payload[4] !== 0x01 ||
    payload[5] !== 0x2a
  ) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  return {
    width: (payload[6] | (payload[7] << 8)) & 0x3fff,
    height: (payload[8] | (payload[9] << 8)) & 0x3fff,
  }
}

function vp8lDimensions(payload: Uint8Array) {
  if (payload.length < 5 || payload[0] !== 0x2f || (payload[4] & 0xe0) !== 0) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  return {
    width: 1 + payload[1] + ((payload[2] & 0x3f) << 8),
    height: 1 + (payload[2] >> 6) + (payload[3] << 2) + ((payload[4] & 0x0f) << 10),
  }
}

function vp8xInfo(payload: Uint8Array) {
  if (
    payload.length !== 10 ||
    (payload[0] & 0xc1) !== 0 ||
    payload[1] !== 0 ||
    payload[2] !== 0 ||
    payload[3] !== 0 ||
    (payload[0] & 0x02) !== 0
  ) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  return {
    flags: payload[0],
    width: 1 + readUint24(payload, 4),
    height: 1 + readUint24(payload, 7),
  }
}

function assertDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_WEBP_DIMENSION ||
    height > MAX_WEBP_DIMENSION ||
    width * height > MAX_WEBP_PIXELS
  ) {
    throw new WebpValidationError('INVALID_DIMENSIONS')
  }
}

export function inspectWebp(bytes: Uint8Array): WebpInfo {
  if (bytes.byteLength > MAX_WEBP_BYTES) {
    throw new WebpValidationError('WEBP_TOO_LARGE')
  }

  if (
    bytes.byteLength < 20 ||
    fourCc(bytes, 0) !== 'RIFF' ||
    fourCc(bytes, 8) !== 'WEBP'
  ) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(4, true) !== bytes.byteLength - 8) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  const chunks: string[] = []
  let offset = 12
  let extendedDimensions: { width: number; height: number } | null = null
  let extendedFlags: number | null = null
  let bitstreamDimensions: { width: number; height: number } | null = null
  let bitstreamCount = 0
  const uniqueChunks = new Set<string>()

  while (offset < bytes.byteLength) {
    if (chunks.length >= MAX_RIFF_CHUNKS || offset + 8 > bytes.byteLength) {
      throw new WebpValidationError('INVALID_WEBP')
    }

    const type = fourCc(bytes, offset)
    const size = view.getUint32(offset + 4, true)
    const payloadStart = offset + 8
    const payloadEnd = payloadStart + size
    const nextOffset = payloadEnd + (size & 1)

    if (
      payloadEnd < payloadStart ||
      nextOffset > bytes.byteLength ||
      ((size & 1) === 1 && bytes[payloadEnd] !== 0)
    ) {
      throw new WebpValidationError('INVALID_WEBP')
    }

    const payload = bytes.subarray(payloadStart, payloadEnd)
    chunks.push(type)

    if (type === 'VP8X') {
      if (extendedDimensions || chunks.length !== 1) {
        throw new WebpValidationError('INVALID_WEBP')
      }
      const info = vp8xInfo(payload)
      extendedFlags = info.flags
      extendedDimensions = { width: info.width, height: info.height }
    } else if (type === 'VP8 ' || type === 'VP8L') {
      bitstreamCount += 1
      if (bitstreamCount !== 1) {
        throw new WebpValidationError('INVALID_WEBP')
      }
      bitstreamDimensions = type === 'VP8 ' ? vp8Dimensions(payload) : vp8lDimensions(payload)
    } else if (type === 'ANIM' || type === 'ANMF') {
      throw new WebpValidationError('INVALID_WEBP')
    } else if (type === 'ICCP' || type === 'ALPH' || type === 'EXIF' || type === 'XMP ') {
      const beforeBitstream = type === 'ICCP' || type === 'ALPH'
      const requiredFlag = type === 'ICCP'
        ? 0x20
        : type === 'ALPH'
        ? 0x10
        : type === 'EXIF'
        ? 0x08
        : 0x04
      if (
        extendedFlags === null ||
        uniqueChunks.has(type) ||
        (extendedFlags & requiredFlag) === 0 ||
        beforeBitstream === (bitstreamCount === 1)
      ) {
        throw new WebpValidationError('INVALID_WEBP')
      }
      uniqueChunks.add(type)
    }

    offset = nextOffset
  }

  if (offset !== bytes.byteLength || bitstreamCount !== 1 || !bitstreamDimensions) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  if (!extendedDimensions && chunks.length !== 1) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  if (
    extendedFlags !== null &&
    (((extendedFlags & 0x20) !== 0) !== uniqueChunks.has('ICCP') ||
      ((extendedFlags & 0x08) !== 0) !== uniqueChunks.has('EXIF') ||
      ((extendedFlags & 0x04) !== 0) !== uniqueChunks.has('XMP ') ||
      ((extendedFlags & 0x10) !== 0 && chunks.includes('VP8 ') && !uniqueChunks.has('ALPH')) ||
      (uniqueChunks.has('ALPH') && chunks.includes('VP8L')))
  ) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  const dimensions = extendedDimensions ?? bitstreamDimensions
  if (
    extendedDimensions &&
    (extendedDimensions.width !== bitstreamDimensions.width ||
      extendedDimensions.height !== bitstreamDimensions.height)
  ) {
    throw new WebpValidationError('INVALID_WEBP')
  }

  assertDimensions(dimensions.width, dimensions.height)
  return { ...dimensions, chunks }
}
