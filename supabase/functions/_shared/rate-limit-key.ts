function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function createRateLimitKey(ip: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip))
  return bytesToHex(new Uint8Array(signature))
}

export function trustedInfrastructureIp(request: Request): string | null {
  // Supabase documenta x-forwarded-for como la fuente de IP en Edge Functions.
  // Solo se acepta en el runtime hospedado (SB_REGION) o en pruebas locales
  // explícitas; fuera de esos contextos se falla de forma cerrada.
  const hostedRuntime = Boolean(Deno.env.get('SB_REGION'))
  const explicitlyTrustedLocalProxy = Deno.env.get('TRUST_LOCAL_PROXY_HEADERS') === 'true'
  if (!hostedRuntime && !explicitlyTrustedLocalProxy) return null

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (!forwardedFor) return null

  const firstAddress = forwardedFor.split(',')[0]?.trim()
  if (!firstAddress || firstAddress.length > 45 || !isValidIpAddress(firstAddress)) {
    return null
  }

  return firstAddress
}

function isValidIpAddress(value: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255)
  }

  if (!value.includes(':') || !/^[0-9a-f:]+$/i.test(value)) return false
  try {
    const parsed = new URL(`http://[${value}]/`)
    return parsed.hostname.length > 2
  } catch {
    return false
  }
}
