import { assertEquals } from '@std/assert'
import { createSubmitReportHandler } from '../submit-report/index.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'

const TEST_ORIGIN = 'http://localhost:5173'
const TEST_PUBLISHABLE_KEY = 'test-publishable-key'
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

const validBody = {
  requestId: '20000000-0000-4000-8000-000000000001',
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  citySlug: 'posadas',
  categoryId: '30000000-0000-4000-8000-000000000001',
  subcategoryId: null,
  description: 'Un reporte válido para las pruebas',
  latitude: -27.36,
  longitude: -55.90,
  urgency: 'medium',
} as const

function request(body: unknown, extraHeaders: HeadersInit = {}): Request {
  return new Request('http://localhost/functions/v1/submit-report', {
    method: 'POST',
    headers: {
      origin: TEST_ORIGIN,
      apikey: TEST_PUBLISHABLE_KEY,
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    allowedOrigins: new Set([TEST_ORIGIN]),
    allowedHostnames: new Set(['localhost']),
    expectedTurnstileAction: 'submit_report',
    turnstileSecret: TURNSTILE_TEST_SECRET,
    rateLimitPepper: 'local-test-pepper-not-a-production-secret',
    publishableKeys: new Set([TEST_PUBLISHABLE_KEY]),
    trustedIp: () => '127.0.0.1',
    verifyChallenge: () => Promise.resolve(true),
    createRateKey: () => Promise.resolve('a'.repeat(64)),
    submitReport: () =>
      Promise.resolve({
        trackingCode: 'PR-0123456789ABCDEF0123',
        createdAt: '2026-08-06T00:00:00.000Z',
        status: 'received' as const,
      }),
    ...overrides,
  }
}

Deno.test('returns exactly the limited public receipt and does not log sensitive data', async () => {
  const originalLog = console.log
  const originalError = console.error
  const logged: unknown[] = []
  console.log = (...values) => logged.push(values)
  console.error = (...values) => logged.push(values)

  try {
    const response = await createSubmitReportHandler(dependencies())(request(validBody))
    assertEquals(response.status, 201)
    assertEquals(await response.json(), {
      trackingCode: 'PR-0123456789ABCDEF0123',
      createdAt: '2026-08-06T00:00:00.000Z',
      status: 'received',
    })
    assertEquals(logged, [])
  } finally {
    console.log = originalLog
    console.error = originalError
  }
})

Deno.test('rejects an absent or untrusted infrastructure IP', async () => {
  const response = await createSubmitReportHandler(
    dependencies({ trustedIp: () => null }),
  )(request(validBody))

  assertEquals(response.status, 503)
  assertEquals(await response.json(), {
    error: 'No se pudo validar el origen de la solicitud.',
  })
})

Deno.test('rejects an oversized streaming body without Content-Length', async () => {
  const oversized = new Uint8Array(20_000).fill(97)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(oversized)
      controller.close()
    },
  })
  const oversizedRequest = new Request('http://localhost/functions/v1/submit-report', {
    method: 'POST',
    headers: {
      origin: TEST_ORIGIN,
      apikey: TEST_PUBLISHABLE_KEY,
      'content-type': 'application/json',
    },
    body: stream,
  })

  assertEquals(oversizedRequest.headers.has('content-length'), false)
  const response = await createSubmitReportHandler(dependencies())(oversizedRequest)
  assertEquals(response.status, 400)
})

Deno.test('rejects unknown fields and incorrect types', async () => {
  const response = await createSubmitReportHandler(dependencies())(
    request({ ...validBody, status: 'approved', latitude: '-27.36' }),
  )
  assertEquals(response.status, 400)
})

Deno.test('requires the configured publishable key independently from CORS', async () => {
  const response = await createSubmitReportHandler(dependencies())(
    request(validBody, { apikey: 'incorrect-key' }),
  )
  assertEquals(response.status, 401)
})

Deno.test('two concurrent calls with one requestId receive the same receipt', async () => {
  let calls = 0
  const handler = createSubmitReportHandler(dependencies({
    submitReport: async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      return {
        trackingCode: 'PR-0123456789ABCDEF0123',
        createdAt: '2026-08-06T00:00:00.000Z',
        status: 'received' as const,
      }
    },
  }))

  const [first, second] = await Promise.all([
    handler(request(validBody)),
    handler(request(validBody)),
  ])

  assertEquals(await first.json(), await second.json())
  assertEquals(calls, 2)
})

Deno.test('maps idempotency conflicts to a generic response', async () => {
  const response = await createSubmitReportHandler(dependencies({
    submitReport: () => Promise.reject(new Error('IDEMPOTENCY_CONFLICT')),
  }))(request(validBody))

  assertEquals(response.status, 409)
  const body = await response.text()
  assertEquals(body.includes(validBody.description), false)
  assertEquals(body.includes(validBody.categoryId), false)
})

Deno.test('sends requestId as Turnstile idempotency_key and verifies action and hostname', async () => {
  let capturedIdempotencyKey: FormDataEntryValue | null = null
  let capturedResponse: FormDataEntryValue | null = null
  let capturedSecret: FormDataEntryValue | null = null
  const accepted = await verifyTurnstile({
    token: validBody.turnstileToken,
    secret: TURNSTILE_TEST_SECRET,
    remoteIp: '127.0.0.1',
    requestId: validBody.requestId,
    expectedAction: 'submit_report',
    allowedHostnames: new Set(['localhost']),
    fetchImplementation: (_input, init) => {
      const form = init?.body as FormData
      capturedIdempotencyKey = form.get('idempotency_key')
      capturedResponse = form.get('response')
      capturedSecret = form.get('secret')
      return Promise.resolve(Response.json({
        success: true,
        action: 'submit_report',
        hostname: 'localhost',
      }))
    },
  })

  assertEquals(accepted, true)
  assertEquals(capturedIdempotencyKey, validBody.requestId)
  assertEquals(capturedResponse, validBody.turnstileToken)
  assertEquals(capturedSecret, TURNSTILE_TEST_SECRET)
})
