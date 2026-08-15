export const MAX_REQUEST_BODY_BYTES = 16_384

export type SubmitReportRequest = {
  requestId: string
  turnstileToken: string
  citySlug: string
  categoryId: string
  subcategoryId: string | null
  description: string
  latitude: number
  longitude: number
  urgency: 'low' | 'medium' | 'high'
}

const EXPECTED_FIELDS = new Set([
  'requestId',
  'turnstileToken',
  'citySlug',
  'categoryId',
  'subcategoryId',
  'description',
  'latitude',
  'longitude',
  'urgency',
])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class RequestValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes = MAX_REQUEST_BODY_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    throw new RequestValidationError('Unsupported media type', 415)
  }

  if (!request.body) {
    throw new RequestValidationError('Missing request body')
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel('Request body too large')
        throw new RequestValidationError('Request body too large', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new RequestValidationError('Invalid JSON')
  }
}

export function validateSubmitReportRequest(value: unknown): SubmitReportRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('Invalid request')
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length !== EXPECTED_FIELDS.size || keys.some((key) => !EXPECTED_FIELDS.has(key))) {
    throw new RequestValidationError('Unexpected fields')
  }

  if (typeof record.requestId !== 'string' || !UUID_PATTERN.test(record.requestId)) {
    throw new RequestValidationError('Invalid requestId')
  }

  if (
    typeof record.turnstileToken !== 'string' ||
    record.turnstileToken.length < 1 ||
    record.turnstileToken.length > 2048
  ) {
    throw new RequestValidationError('Invalid Turnstile token')
  }

  if (
    typeof record.citySlug !== 'string' ||
    !CITY_SLUG_PATTERN.test(record.citySlug) ||
    record.citySlug.length > 80
  ) {
    throw new RequestValidationError('Invalid city')
  }

  if (typeof record.categoryId !== 'string' || !UUID_PATTERN.test(record.categoryId)) {
    throw new RequestValidationError('Invalid category')
  }

  if (
    record.subcategoryId !== null &&
    (typeof record.subcategoryId !== 'string' || !UUID_PATTERN.test(record.subcategoryId))
  ) {
    throw new RequestValidationError('Invalid subcategory')
  }

  if (typeof record.description !== 'string') {
    throw new RequestValidationError('Invalid description')
  }

  const description = record.description.trim()
  if (description.length < 10 || description.length > 1000) {
    throw new RequestValidationError('Invalid description')
  }

  if (
    typeof record.latitude !== 'number' ||
    !Number.isFinite(record.latitude) ||
    record.latitude < -90 ||
    record.latitude > 90 ||
    typeof record.longitude !== 'number' ||
    !Number.isFinite(record.longitude) ||
    record.longitude < -180 ||
    record.longitude > 180
  ) {
    throw new RequestValidationError('Invalid coordinates')
  }

  if (record.urgency !== 'low' && record.urgency !== 'medium' && record.urgency !== 'high') {
    throw new RequestValidationError('Invalid urgency')
  }

  return {
    requestId: record.requestId,
    turnstileToken: record.turnstileToken,
    citySlug: record.citySlug,
    categoryId: record.categoryId,
    subcategoryId: record.subcategoryId as string | null,
    description,
    latitude: record.latitude,
    longitude: record.longitude,
    urgency: record.urgency,
  }
}
