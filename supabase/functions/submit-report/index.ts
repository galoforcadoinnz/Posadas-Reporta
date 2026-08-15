import { createClient } from '@supabase/supabase-js'
import { corsHeaders, parseAllowedOrigins } from '../_shared/cors.ts'
import { createRateLimitKey, trustedInfrastructureIp } from '../_shared/rate-limit-key.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'
import {
  readJsonBody,
  RequestValidationError,
  validateSubmitReportRequest,
} from '../_shared/validation.ts'

type PublicReceipt = {
  trackingCode: string
  createdAt: string
  status: 'received'
}

type SubmitReportInput = {
  requestId: string
  rateLimitKey: string
  citySlug: string
  categoryId: string
  subcategoryId: string | null
  description: string
  latitude: number
  longitude: number
  urgency: 'low' | 'medium' | 'high'
}

type RpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

type HandlerDependencies = {
  allowedOrigins: Set<string>
  allowedHostnames: Set<string>
  expectedTurnstileAction: string
  turnstileSecret: string
  rateLimitPepper: string
  publishableKeys: Set<string>
  trustedIp: (request: Request) => string | null
  verifyChallenge: typeof verifyTurnstile
  createRateKey: typeof createRateLimitKey
  submitReport: (input: SubmitReportInput) => Promise<PublicReceipt>
}

function parseNamedKeys(value: string | undefined, name: string): string[] {
  if (!value) return []
  try {
    const record = JSON.parse(value) as Record<string, unknown>
    const keys = Object.values(record)
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
    if (keys.length === 0) throw new Error('No keys configured')
    return keys
  } catch {
    throw new Error(`Invalid server configuration: ${name}`)
  }
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}

function requireStrongSecret(name: string, minimumBytes: number): string {
  const value = requireEnvironment(name)
  if (new TextEncoder().encode(value).byteLength < minimumBytes) {
    throw new Error(`Invalid server configuration: ${name}`)
  }
  return value
}

function secretKey(): string {
  const namedKeys = parseNamedKeys(Deno.env.get('SUPABASE_SECRET_KEYS'), 'SUPABASE_SECRET_KEYS')
  return namedKeys[0] ?? requireEnvironment('SUPABASE_SERVICE_ROLE_KEY')
}

export function createRpcSubmitter(client: RpcClient) {
  return async (input: SubmitReportInput): Promise<PublicReceipt> => {
    const { data, error } = await client.rpc('submit_report_v1', {
      p_submission_id: input.requestId,
      p_rate_limit_key: input.rateLimitKey,
      p_city_slug: input.citySlug,
      p_category_id: input.categoryId,
      p_subcategory_id: input.subcategoryId,
      p_description: input.description,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_urgency: input.urgency,
    })

    if (error || !Array.isArray(data) || data.length !== 1) {
      const code = error?.message === 'IDEMPOTENCY_CONFLICT'
        ? 'IDEMPOTENCY_CONFLICT'
        : error?.message === 'RATE_LIMIT_EXCEEDED'
        ? 'RATE_LIMIT_EXCEEDED'
        : error?.message === 'LOCATION_OUTSIDE_CITY'
        ? 'LOCATION_OUTSIDE_CITY'
        : error?.message === 'CITY_REPORTING_BOUNDS_UNAVAILABLE'
        ? 'CITY_REPORTING_BOUNDS_UNAVAILABLE'
        : error?.message === 'INVALID_SUBMISSION'
        ? 'INVALID_SUBMISSION'
        : 'SUBMISSION_FAILED'
      throw new Error(code)
    }

    const row = data[0] as Record<string, unknown>
    if (
      typeof row.tracking_code !== 'string' ||
      typeof row.created_at !== 'string' ||
      row.status !== 'received'
    ) {
      throw new Error('SUBMISSION_FAILED')
    }

    return {
      trackingCode: row.tracking_code,
      createdAt: row.created_at,
      status: 'received',
    }
  }
}

function defaultDependencies(): HandlerDependencies {
  const supabase = createClient(requireEnvironment('SUPABASE_URL'), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const publishableKeys = new Set([
    ...parseNamedKeys(
      Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
      'SUPABASE_PUBLISHABLE_KEYS',
    ),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    Deno.env.get('SUPABASE_ANON_KEY'),
  ].filter((value): value is string => Boolean(value)))

  if (publishableKeys.size === 0) {
    throw new Error('Missing server configuration: SUPABASE_PUBLISHABLE_KEYS')
  }

  return {
    allowedOrigins: parseAllowedOrigins(requireEnvironment('ALLOWED_ORIGINS')),
    allowedHostnames: parseAllowedOrigins(requireEnvironment('TURNSTILE_ALLOWED_HOSTNAMES')),
    expectedTurnstileAction: requireEnvironment('TURNSTILE_EXPECTED_ACTION'),
    turnstileSecret: requireEnvironment('TURNSTILE_SECRET_KEY'),
    rateLimitPepper: requireStrongSecret('RATE_LIMIT_PEPPER', 32),
    publishableKeys,
    trustedIp: trustedInfrastructureIp,
    verifyChallenge: verifyTurnstile,
    createRateKey: createRateLimitKey,
    submitReport: createRpcSubmitter(supabase),
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string,
  additionalHeaders: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(origin),
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...additionalHeaders,
    },
  })
}

export function createSubmitReportHandler(dependencies: HandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') ?? ''
    if (!dependencies.allowedOrigins.has(origin)) {
      return Response.json(
        { code: 'ORIGIN_NOT_ALLOWED', error: 'Solicitud no permitida.' },
        { status: 403, headers: { 'Cache-Control': 'no-store', Vary: 'Origin' } },
      )
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { code: 'METHOD_NOT_ALLOWED', error: 'Método no permitido.' },
        405,
        origin,
        { Allow: 'POST, OPTIONS' },
      )
    }

    const apiKey = request.headers.get('apikey')
    if (!apiKey || !dependencies.publishableKeys.has(apiKey)) {
      return jsonResponse(
        { code: 'INVALID_API_KEY', error: 'Solicitud no autorizada.' },
        401,
        origin,
      )
    }

    const ip = dependencies.trustedIp(request)
    if (!ip) {
      return jsonResponse(
        {
          code: 'TRUSTED_IP_UNAVAILABLE',
          error: 'No se pudo validar el origen de la solicitud.',
        },
        503,
        origin,
      )
    }

    let input
    try {
      input = validateSubmitReportRequest(await readJsonBody(request))
    } catch (error) {
      if (error instanceof RequestValidationError) {
        const code = error.status === 413
          ? 'BODY_TOO_LARGE'
          : error.status === 415
          ? 'UNSUPPORTED_MEDIA_TYPE'
          : 'INVALID_REQUEST'
        return jsonResponse(
          { code, error: 'Los datos del reporte no son válidos.' },
          error.status,
          origin,
        )
      }
      return jsonResponse(
        { code: 'SUBMISSION_FAILED', error: 'No se pudo procesar el reporte.' },
        500,
        origin,
      )
    }

    let challengeIsValid = false
    try {
      challengeIsValid = await dependencies.verifyChallenge({
        token: input.turnstileToken,
        secret: dependencies.turnstileSecret,
        remoteIp: ip,
        requestId: input.requestId,
        expectedAction: dependencies.expectedTurnstileAction,
        allowedHostnames: dependencies.allowedHostnames,
      })
    } catch {
      return jsonResponse(
        { code: 'TURNSTILE_UNAVAILABLE', error: 'No se pudo completar la verificación.' },
        503,
        origin,
      )
    }

    if (!challengeIsValid) {
      return jsonResponse(
        { code: 'TURNSTILE_INVALID', error: 'La verificación antiabuso no fue válida.' },
        403,
        origin,
      )
    }

    try {
      const rateLimitKey = await dependencies.createRateKey(ip, dependencies.rateLimitPepper)
      const receipt = await dependencies.submitReport({
        requestId: input.requestId,
        rateLimitKey,
        citySlug: input.citySlug,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        urgency: input.urgency,
      })

      return jsonResponse(receipt, 201, origin)
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SUBMISSION_FAILED'
      if (code === 'RATE_LIMIT_EXCEEDED') {
        return jsonResponse(
          { code, error: 'Alcanzaste temporalmente el límite de reportes.' },
          429,
          origin,
          { 'Retry-After': '900' },
        )
      }
      if (code === 'IDEMPOTENCY_CONFLICT') {
        return jsonResponse(
          { code, error: 'La solicitud no pudo reutilizarse.' },
          409,
          origin,
        )
      }
      if (code === 'LOCATION_OUTSIDE_CITY') {
        return jsonResponse(
          { code, error: 'La ubicación está fuera del área habilitada.' },
          400,
          origin,
        )
      }
      if (code === 'CITY_REPORTING_BOUNDS_UNAVAILABLE') {
        return jsonResponse(
          { code, error: 'Los reportes no están habilitados temporalmente.' },
          503,
          origin,
        )
      }
      if (code === 'INVALID_SUBMISSION') {
        return jsonResponse(
          { code, error: 'Los datos del reporte no son válidos.' },
          400,
          origin,
        )
      }
      return jsonResponse(
        { code: 'SUBMISSION_FAILED', error: 'No se pudo guardar el reporte.' },
        500,
        origin,
      )
    }
  }
}

if (import.meta.main) {
  const handler = createSubmitReportHandler(defaultDependencies())
  Deno.serve((request) => handler(request))
}
