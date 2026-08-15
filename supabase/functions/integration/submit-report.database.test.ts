import { assertEquals, assertMatch } from '@std/assert'
import { createRateLimitKey } from '../_shared/rate-limit-key.ts'
import { createRpcSubmitter, createSubmitReportHandler } from '../submit-report/index.ts'

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const containerName = requireEnvironment('POSADAS_DATABASE_TEST_CONTAINER')

const origin = 'http://localhost:4173'
const publishableKey = 'integration-publishable-key'
const requestId = '20000000-0000-4000-8000-00000000e001'

type RpcResult = {
  data: unknown
  error: { message: string } | null
}

function knownDatabaseError(stderr: string): string | null {
  return [
    'IDEMPOTENCY_CONFLICT',
    'RATE_LIMIT_EXCEEDED',
    'LOCATION_OUTSIDE_CITY',
    'CITY_REPORTING_BOUNDS_UNAVAILABLE',
    'INVALID_SUBMISSION',
  ].find((code) => stderr.includes(code)) ?? null
}

async function executeSql(sql: string, variables: Record<string, string> = {}) {
  const variableArguments = Object.entries(variables).flatMap(([name, value]) => [
    '-v',
    `${name}=${value}`,
  ])
  const command = new Deno.Command('docker', {
    args: [
      'exec',
      '--interactive',
      containerName,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      ...variableArguments,
    ],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
  }).spawn()

  const writer = command.stdin.getWriter()
  await writer.write(new TextEncoder().encode(sql))
  await writer.close()
  const output = await command.output()
  return {
    success: output.success,
    stdout: new TextDecoder().decode(output.stdout).trim(),
    stderr: new TextDecoder().decode(output.stderr),
  }
}

const psqlRpcClient = {
  async rpc(functionName: string, parameters: Record<string, unknown>): Promise<RpcResult> {
    assertEquals(functionName, 'submit_report_v1')
    const variables = Object.fromEntries(
      Object.entries(parameters).map((
        [name, value],
      ) => [name, value === null ? '' : String(value)]),
    )
    const result = await executeSql(
      `SELECT row_to_json(receipt)::text
       FROM public.submit_report_v1(
         :'p_submission_id'::uuid,
         :'p_rate_limit_key',
         :'p_city_slug',
         :'p_category_id'::uuid,
         NULLIF(:'p_subcategory_id', '')::uuid,
         :'p_description',
         :'p_latitude'::double precision,
         :'p_longitude'::double precision,
         :'p_urgency'
       ) AS receipt;`,
      variables,
    )

    if (!result.success) {
      return { data: null, error: { message: knownDatabaseError(result.stderr) ?? 'RPC_FAILED' } }
    }
    return { data: [JSON.parse(result.stdout)], error: null }
  },
}

Deno.test('submits through the Edge handler and the real PostgreSQL RPC', async () => {
  await executeSql(
    "UPDATE public.cities SET reporting_min_latitude=-90, reporting_max_latitude=90, reporting_min_longitude=-180, reporting_max_longitude=180 WHERE slug='posadas';",
  )

  const handler = createSubmitReportHandler({
    allowedOrigins: new Set([origin]),
    allowedHostnames: new Set(['localhost']),
    expectedTurnstileAction: 'submit_report',
    turnstileSecret: 'integration-only-turnstile-secret',
    rateLimitPepper: 'integration-only-pepper-with-at-least-32-bytes',
    publishableKeys: new Set([publishableKey]),
    trustedIp: () => '2001:db8::10',
    verifyChallenge: () => Promise.resolve(true),
    createRateKey: createRateLimitKey,
    submitReport: createRpcSubmitter(psqlRpcClient),
  })

  const body = {
    requestId,
    turnstileToken: 'integration-turnstile-token',
    citySlug: 'posadas',
    categoryId: '2f51a29c-04e5-4b54-854b-180f2d252d64',
    subcategoryId: null,
    description: 'Integración local completa entre Edge y PostgreSQL RPC',
    latitude: -27.36,
    longitude: -55.90,
    urgency: 'medium',
  }
  const invoke = () =>
    handler(
      new Request('http://localhost/functions/v1/submit-report', {
        method: 'POST',
        headers: {
          origin,
          apikey: publishableKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    )

  const first = await invoke()
  const second = await invoke()
  assertEquals(first.status, 201)
  assertEquals(second.status, 201)
  const firstReceipt = await first.json()
  assertEquals(await second.json(), firstReceipt)
  assertMatch(firstReceipt.trackingCode, /^PR-[0-9A-F]{20}$/)

  const counts = await executeSql(
    `SELECT
       (SELECT count(*) FROM public.reports WHERE submission_id=:'request_id'::uuid),
       (SELECT count(*) FROM posadas_reporta_private.report_submission_rate_events
        WHERE submission_id=:'request_id'::uuid);`,
    { request_id: requestId },
  )
  assertEquals(counts.success, true)
  assertEquals(counts.stdout, '1|1')
})
