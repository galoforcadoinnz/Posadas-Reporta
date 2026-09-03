import { assertEquals, assertThrows } from '@std/assert'
import { inspectWebp, MAX_WEBP_BYTES, WebpValidationError } from '../_shared/webp.ts'

function chunk(type: string, payload: number[]) {
  const result = new Uint8Array(8 + payload.length + (payload.length & 1))
  result.set(new TextEncoder().encode(type), 0)
  new DataView(result.buffer).setUint32(4, payload.length, true)
  result.set(payload, 8)
  return result
}

function webp(...chunks: Uint8Array[]) {
  const size = 12 + chunks.reduce((total, value) => total + value.length, 0)
  const result = new Uint8Array(size)
  result.set(new TextEncoder().encode('RIFF'), 0)
  new DataView(result.buffer).setUint32(4, size - 8, true)
  result.set(new TextEncoder().encode('WEBP'), 8)
  let offset = 12
  for (const value of chunks) {
    result.set(value, offset)
    offset += value.length
  }
  return result
}

function vp8(width: number, height: number) {
  return chunk('VP8 ', [
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    width & 0xff,
    (width >> 8) & 0x3f,
    height & 0xff,
    (height >> 8) & 0x3f,
  ])
}

function vp8x(width: number, height: number, flags = 0) {
  const widthMinusOne = width - 1
  const heightMinusOne = height - 1
  return chunk('VP8X', [
    flags,
    0,
    0,
    0,
    widthMinusOne & 0xff,
    (widthMinusOne >> 8) & 0xff,
    (widthMinusOne >> 16) & 0xff,
    heightMinusOne & 0xff,
    (heightMinusOne >> 8) & 0xff,
    (heightMinusOne >> 16) & 0xff,
  ])
}

function vp8l(width: number, height: number) {
  const widthMinusOne = width - 1
  const heightMinusOne = height - 1
  return chunk('VP8L', [
    0x2f,
    widthMinusOne & 0xff,
    ((widthMinusOne >> 8) & 0x3f) | ((heightMinusOne & 0x03) << 6),
    (heightMinusOne >> 2) & 0xff,
    (heightMinusOne >> 10) & 0x0f,
  ])
}

function expectCode(bytes: Uint8Array, code: WebpValidationError['code']) {
  const error = assertThrows(() => inspectWebp(bytes), WebpValidationError)
  assertEquals(error.code, code)
}

Deno.test('accepts one bounded lossy WebP bitstream', () => {
  assertEquals(inspectWebp(webp(vp8(1600, 900))), {
    width: 1600,
    height: 900,
    chunks: ['VP8 '],
  })
})

Deno.test('accepts one bounded lossless WebP bitstream', () => {
  assertEquals(inspectWebp(webp(vp8l(1200, 1600))), {
    width: 1200,
    height: 1600,
    chunks: ['VP8L'],
  })
})

Deno.test('accepts bounded extended WebP and records metadata chunks', () => {
  const bytes = webp(
    vp8x(800, 600, 0x0c),
    vp8(800, 600),
    chunk('EXIF', [1, 2, 3]),
    chunk('XMP ', [4, 5]),
  )

  assertEquals(inspectWebp(bytes), {
    width: 800,
    height: 600,
    chunks: ['VP8X', 'VP8 ', 'EXIF', 'XMP '],
  })
})

Deno.test('rejects an oversized body before parsing it', () => {
  expectCode(new Uint8Array(MAX_WEBP_BYTES + 1), 'WEBP_TOO_LARGE')
})

Deno.test('rejects truncated chunks and trailing polyglot bytes', () => {
  const truncated = webp(vp8(100, 100)).subarray(0, 20)
  expectCode(truncated, 'INVALID_WEBP')

  const polyglot = new Uint8Array([...webp(vp8(100, 100)), ...new TextEncoder().encode('<svg/>')])
  expectCode(polyglot, 'INVALID_WEBP')
})

Deno.test('rejects excessive or contradictory dimensions', () => {
  expectCode(webp(vp8(1601, 900)), 'INVALID_DIMENSIONS')
  expectCode(webp(vp8x(800, 600), vp8(801, 600)), 'INVALID_WEBP')
})

Deno.test('rejects animation, duplicate bitstreams and invalid reserved bits', () => {
  expectCode(webp(vp8x(100, 100, 0x02), vp8(100, 100)), 'INVALID_WEBP')
  expectCode(webp(vp8(100, 100), vp8(100, 100)), 'INVALID_WEBP')
  expectCode(webp(vp8x(100, 100, 0x01), vp8(100, 100)), 'INVALID_WEBP')
})

Deno.test('rejects non-keyframes, non-zero padding and extended chunks without VP8X', () => {
  const interframe = vp8(100, 100)
  interframe[8] = 1
  expectCode(webp(interframe), 'INVALID_WEBP')

  const metadata = chunk('EXIF', [1])
  metadata[metadata.length - 1] = 1
  expectCode(webp(vp8x(100, 100, 0x08), vp8(100, 100), metadata), 'INVALID_WEBP')

  expectCode(webp(chunk('JUNK', [0, 0]), vp8(100, 100)), 'INVALID_WEBP')
})

Deno.test('rejects missing, duplicate and out-of-order extended chunks', () => {
  expectCode(webp(vp8x(100, 100, 0x08), vp8(100, 100)), 'INVALID_WEBP')
  expectCode(
    webp(vp8x(100, 100, 0x08), vp8(100, 100), chunk('EXIF', [0]), chunk('EXIF', [0])),
    'INVALID_WEBP',
  )
  expectCode(webp(vp8x(100, 100, 0x08), chunk('EXIF', [0]), vp8(100, 100)), 'INVALID_WEBP')
  expectCode(webp(vp8x(100, 100, 0x10), vp8(100, 100)), 'INVALID_WEBP')
})
