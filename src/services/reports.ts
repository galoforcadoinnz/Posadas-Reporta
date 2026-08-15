import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ReportReceipt, Urgency } from '../types/report'

export type ReportSubmissionErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_SUBMISSION'
  | 'BODY_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'LOCATION_OUTSIDE_CITY'
  | 'CITY_REPORTING_BOUNDS_UNAVAILABLE'
  | 'TURNSTILE_INVALID'
  | 'TURNSTILE_UNAVAILABLE'
  | 'TRUSTED_IP_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NETWORK_ERROR'
  | 'SUBMISSION_FAILED'

const KNOWN_ERROR_CODES = new Set<ReportSubmissionErrorCode>([
  'INVALID_REQUEST',
  'INVALID_SUBMISSION',
  'BODY_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'LOCATION_OUTSIDE_CITY',
  'CITY_REPORTING_BOUNDS_UNAVAILABLE',
  'TURNSTILE_INVALID',
  'TURNSTILE_UNAVAILABLE',
  'TRUSTED_IP_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
  'IDEMPOTENCY_CONFLICT',
  'SUBMISSION_FAILED',
])

export class ReportSubmissionError extends Error {
  readonly code: ReportSubmissionErrorCode
  readonly status: number | null
  readonly retryAfterSeconds: number | null

  constructor(
    code: ReportSubmissionErrorCode,
    status: number | null = null,
    retryAfterSeconds: number | null = null
  ) {
    super(code)
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type CreateReportInput = {
  requestId: string
  turnstileToken: string
  citySlug: string
  categoryId: string
  subcategoryId?: string | null
  description: string
  latitude: number
  longitude: number
  urgency: Urgency
}

async function toSubmissionError(error: unknown): Promise<ReportSubmissionError> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    const status = error.context.status
    const retryAfterValue = error.context.headers.get('retry-after')
    const retryAfterSeconds = retryAfterValue ? Number.parseInt(retryAfterValue, 10) : null
    let code: ReportSubmissionErrorCode = 'SUBMISSION_FAILED'

    try {
      const body = await error.context.clone().json() as { code?: unknown }
      if (typeof body.code === 'string' && KNOWN_ERROR_CODES.has(body.code as ReportSubmissionErrorCode)) {
        code = body.code as ReportSubmissionErrorCode
      }
    } catch {
      // La respuesta pública puede no ser JSON. No se exponen detalles técnicos.
    }

    return new ReportSubmissionError(
      code,
      status,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null
    )
  }

  return new ReportSubmissionError('NETWORK_ERROR')
}

export async function createReport(
  input: CreateReportInput
): Promise<ReportReceipt> {
  const { data, error } = await supabase.functions.invoke('submit-report', {
    body: {
      requestId: input.requestId,
      turnstileToken: input.turnstileToken,
      citySlug: input.citySlug,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId ?? null,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      urgency: input.urgency,
    },
  })

  if (error) {
    throw await toSubmissionError(error)
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).length !== 3 ||
    typeof data.trackingCode !== 'string' ||
    typeof data.createdAt !== 'string' ||
    data.status !== 'received'
  ) {
    throw new ReportSubmissionError('SUBMISSION_FAILED')
  }

  return {
    trackingCode: data.trackingCode,
    createdAt: data.createdAt,
    status: 'received',
  }
}
