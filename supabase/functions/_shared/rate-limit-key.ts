function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function createRateLimitKey(ip: string, pepper: string): Promise<string> {
  if (new TextEncoder().encode(pepper).byteLength < 32) {
    throw new Error('RATE_LIMIT_PEPPER must contain at least 32 bytes')
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`posadas-reporta:rate-limit:v1:${ip}`),
  )
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

  // La función falla de forma cerrada ante cadenas de proxies. En el entorno
  // autorizado, el gateway debe entregar un único valor ya sanitizado; aceptar
  // el primer elemento permitiría confiar accidentalmente en un valor agregado
  // por el cliente antes de llegar al proxy.
  if (forwardedFor.includes(',')) return null

  return canonicalIpAddress(forwardedFor.trim())
}

export function canonicalIpAddress(value: string): string | null {
  if (!value || value.length > 45) return null

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split('.')
    if (!parts.every((part) => Number(part) <= 255)) return null
    return parts.map((part) => String(Number(part))).join('.')
  }

  if (!value.includes(':') || !/^[0-9a-f:]+$/i.test(value)) return null
  try {
    const parsed = new URL(`http://[${value}]/`)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
    return hostname.includes(':') ? hostname.toLowerCase() : null
  } catch {
    return null
  }
}
