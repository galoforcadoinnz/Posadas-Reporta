export function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
}

export function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  }
}
