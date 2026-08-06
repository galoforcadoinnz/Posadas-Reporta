function requireEnvironmentVariable(
  name: string,
  value: string | undefined
): string {
  if (!value?.trim()) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`)
  }

  return value
}

export const env = {
  supabaseUrl: requireEnvironmentVariable(
    'VITE_SUPABASE_URL',
    import.meta.env.VITE_SUPABASE_URL
  ),
  supabasePublishableKey: requireEnvironmentVariable(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ),
  citySlug: requireEnvironmentVariable(
    'VITE_CITY_SLUG',
    import.meta.env.VITE_CITY_SLUG
  ),
  turnstileSiteKey: requireEnvironmentVariable(
    'VITE_TURNSTILE_SITE_KEY',
    import.meta.env.VITE_TURNSTILE_SITE_KEY
  ),
}
