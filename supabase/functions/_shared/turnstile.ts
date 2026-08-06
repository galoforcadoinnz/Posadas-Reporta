export type TurnstileVerification = {
  success: boolean
  action?: string
  hostname?: string
}

type VerifyTurnstileOptions = {
  token: string
  secret: string
  remoteIp: string
  requestId: string
  expectedAction: string
  allowedHostnames: Set<string>
  fetchImplementation?: typeof fetch
}

export async function verifyTurnstile({
  token,
  secret,
  remoteIp,
  requestId,
  expectedAction,
  allowedHostnames,
  fetchImplementation = fetch,
}: VerifyTurnstileOptions): Promise<boolean> {
  const form = new FormData()
  form.set('secret', secret)
  form.set('response', token)
  form.set('remoteip', remoteIp)
  form.set('idempotency_key', requestId)

  let response: Response
  try {
    response = await fetchImplementation(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    return false
  }

  if (!response.ok) return false

  let result: TurnstileVerification
  try {
    result = await response.json()
  } catch {
    return false
  }

  return result.success === true &&
    result.action === expectedAction &&
    typeof result.hostname === 'string' &&
    allowedHostnames.has(result.hostname)
}
