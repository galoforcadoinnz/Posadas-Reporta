import { expect, test } from '@playwright/test'

test('completes the secure flow without a direct reports POST', async ({ page }) => {
  let directReportsPosts = 0
  let unpkgRequests = 0
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
    'Access-Control-Allow-Headers':
      'apikey, authorization, content-type, x-client-info, x-retry-count',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: {
              latitude: -27.36,
              longitude: -55.90,
              accuracy: 5,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition)
        },
      },
    })
  })

  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={ready:(cb)=>cb(),render:(container,params)=>{setTimeout(()=>params.callback('XXXX.DUMMY.TOKEN.XXXX'),0);return 'widget'},reset:()=>{},remove:()=>{},getResponse:()=>'',isExpired:()=>false};`,
    }))
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort())
  await page.route('https://unpkg.com/**', (route) => {
    unpkgRequests += 1
    return route.abort()
  })

  await page.route('http://127.0.0.1:54321/rest/v1/**', async (route) => {
    const url = route.request().url()
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    if (url.includes('/reports') && route.request().method() === 'POST') {
      directReportsPosts += 1
    }
    if (url.includes('/cities')) {
      await route.fulfill({
        contentType: 'application/json',
        headers: { ...corsHeaders, 'Content-Range': '0-0/1' },
        body: JSON.stringify({
          id: 'a03b4d86-3784-41ae-a264-a51441e0b397',
          name: 'Posadas',
          slug: 'posadas',
          is_active: true,
          reporting_min_latitude: -28,
          reporting_max_latitude: -27,
          reporting_min_longitude: -56,
          reporting_max_longitude: -55,
        }),
      })
    } else if (url.includes('/subcategories')) {
      await route.fulfill({
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([{
          id: '40000000-0000-4000-8000-000000000001',
          category_id: '30000000-0000-4000-8000-000000000001',
          name: 'Bache en calzada',
          description: 'Rotura sobre una calle transitable',
          is_active: true,
          created_at: '2026-08-06T00:00:00.000Z',
        }]),
      })
    } else if (url.includes('/categories')) {
      await route.fulfill({
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([{
          id: '30000000-0000-4000-8000-000000000001',
          name: 'Baches',
          description: 'Problemas en la calzada',
          icon: '🕳️',
          is_active: true,
          created_at: '2026-08-06T00:00:00.000Z',
        }]),
      })
    } else {
      await route.fulfill({ status: 404, body: '{}' })
    }
  })

  await page.route('http://127.0.0.1:54321/functions/v1/submit-report', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    const body = route.request().postDataJSON()
    expect(body).not.toHaveProperty('photo')
    expect(body).not.toHaveProperty('status')
    expect(body.turnstileToken).toBe('XXXX.DUMMY.TOKEN.XXXX')
    expect(body.subcategoryId).toBe('40000000-0000-4000-8000-000000000001')
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        trackingCode: 'PR-0123456789ABCDEF0123',
        createdAt: '2026-08-06T00:00:00.000Z',
        status: 'received',
      }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: '📍 Usar mi ubicación' }).click()
  await page.getByRole('button', { name: 'Continuar →' }).click()
  await page.getByRole('button', { name: /Baches/ }).click()
  await page.getByLabel(/Bache en calzada/).click()
  await page.getByRole('button', { name: 'Continuar →' }).click()
  await page.getByLabel('¿Qué está pasando?').fill('Hay un bache peligroso en la calzada')
  await page.getByLabel('📸 Agregar una fotografía').setInputFiles({
    name: 'camera-with-metadata.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    ),
  })
  await expect(page.getByText(/Fotografía preparada/)).toBeVisible()
  await page.getByRole('button', { name: 'Ver resumen →' }).click()
  await expect(page.getByRole('img', { name: 'Vista previa del reporte' }))
    .toBeVisible()
  const confirm = page.getByRole('button', { name: '✅ Confirmar reporte' })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByRole('heading', { name: '✅ Reporte recibido' })).toBeVisible()
  await expect(page.getByText('PR-0123456789ABCDEF0123')).toBeVisible()
  expect(directReportsPosts).toBe(0)
  expect(unpkgRequests).toBe(0)
})
