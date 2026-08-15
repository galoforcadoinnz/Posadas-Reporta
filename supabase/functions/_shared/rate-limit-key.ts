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
  const hostedRuntime = Boolean(Deno.env.get('SB_REGION'))
  const explicitlyTrustedLocalProxy = Deno.env.get('TRUST_LOCAL_PROXY_HEADERS') === 'true'

  // Supabase hosted se encuentra detrás de Cloudflare. CF-Connecting-IP es una
  // única dirección agregada por el edge; X-Forwarded-For puede conservar una
  // cadena aportada por el cliente y no es una identidad segura para la cuota.
  if (hostedRuntime) {
    const cloudflareIp = request.headers.get('cf-connecting-ip')
    if (!cloudflareIp || cloudflareIp.includes(',')) return null
    return canonicalIpAddress(cloudflareIp.trim())
  }

  // El proxy local solo se confía durante pruebas que lo habilitan de forma
  // explícita. Cualquier otro runtime falla de forma cerrada.
  if (!explicitlyTrustedLocalProxy) return null

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (!forwardedFor) return null

  // Las pruebas locales también exigen una única dirección ya sanitizada.
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
