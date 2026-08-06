# Fase 2 — Envío público seguro de reportes

**Estado:** implementación local; no aplicada a ningún proyecto remoto

**Producción protegida:** `xouoxuoueutukemaqjro`

## Objetivo

Reemplazar el `INSERT` directo desde React por una Edge Function que valide
origen, entrada, Turnstile e IP confiable y que invoque una única RPC de mínimo
privilegio. La respuesta pública contiene exclusivamente `trackingCode`,
`createdAt` y `status: "received"`.

No se agrega lectura pública de reportes, consulta por tracking, fotografías,
autenticación, mapa público ni administración.

## Flujo y límites de confianza

```text
React + clave publicable
  → submit-report Edge Function
    → Siteverify de Cloudflare Turnstile
      → HMAC-SHA-256 de IP confiable
        → submit_report_v1 como service_role
          → PostgreSQL, triggers e integridad de Fase 1B
```

- CORS limita navegadores admitidos, pero no autentica.
- La función valida el header `apikey` contra las claves publicables configuradas.
- La secret key solo existe en el runtime de la Edge Function.
- `service_role` no recibe permisos directos sobre tablas; solo `EXECUTE` sobre
  `public.submit_report_v1`.
- La RPC es `SECURITY DEFINER`, propiedad de `postgres`, con `search_path = ''`
  y objetos calificados.

## Turnstile

La función llama siempre a Siteverify y exige `success = true`, acción
`submit_report` y un hostname de `TURNSTILE_ALLOWED_HOSTNAMES`. Envía el mismo
`requestId` como `idempotency_key` y la IP confiable como `remoteip`.

Cada invocación reinicia el widget. Las pruebas usan las claves oficiales de
prueba; ninguna clave real se versiona.

## IP y rate limiting

La fuente es el primer valor de `x-forwarded-for`, siguiendo el ejemplo oficial
de Supabase para Edge Functions, pero solo se acepta cuando `SB_REGION` confirma
el runtime hospedado. En local se requiere `TRUST_LOCAL_PROXY_HEADERS=true`. Si
falta una IP confiable, la función falla de forma cerrada.

La IP nunca se almacena. La Edge Function calcula un HMAC-SHA-256 estable con
`RATE_LIMIT_PEPPER`; PostgreSQL recibe 64 caracteres hexadecimales. La RPC
serializa cada HMAC y aplica ventanas móviles de 5 reportes en 15 minutos y 20
en 24 horas. Conteo, incremento, idempotencia e inserción son una transacción.

`pg_cron` elimina cada hora identificadores con más de 48 horas. La migración
verifica `cron.schedule(text,text,text)` y `cron.job` antes de alterar objetos;
no instala extensiones.

## Idempotencia

`reports.submission_id` es único. PostgreSQL calcula una huella SHA-256 del JSONB
canónico con ciudad, categoría, subcategoría, descripción normalizada,
coordenadas y urgencia.

- mismo `requestId` y contenido: mismo comprobante, sin nueva fila ni cuota;
- mismo `requestId` y contenido diferente: conflicto genérico;
- concurrencia: advisory lock y constraint `UNIQUE` preservan una fila.

## Geografía y bloqueo de staging

Fuente oficial consultada el 6 de agosto de 2026:

- Mapoteca de la Secretaría de Planificación Estratégica y Territorial de la
  Municipalidad de Posadas:
  `https://posadas.gov.ar/planurbano/mapoteca/`.

La fuente publica mapas base, subdivisiones y archivos editables, pero no se
encontró un rectángulo georreferenciado verificable que pueda copiarse sin
interpretación cartográfica. Los cuatro límites quedan en `NULL` y la RPC
responde `CITY_REPORTING_BOUNDS_UNAVAILABLE`.

Este es el único bloqueo deliberado para staging. Antes de habilitar envíos se
debe obtener el archivo municipal georreferenciado, documentar su sistema de
referencia, convertirlo a WGS84/EPSG:4326, calcular su envolvente y revisar los
cuatro extremos. No se aceptan coordenadas aproximadas.

## Migraciones y corte

1. `20260806010100_create_secure_report_submission.sql`: RPC, idempotencia,
   rate limiting, limpieza y límites configurables. Conserva temporalmente el
   INSERT heredado para probar la función.
2. `20260806010200_disable_direct_report_inserts.sql`: revoca el INSERT de
   `anon` y `authenticated`, elimina exclusivamente la política heredada y
   retira el fallback fijo de Posadas.

La segunda migración contiene `DROP POLICY`. No elimina filas ni columnas. La
alternativa es una política dormida detrás de grants revocados, pero deja una
capacidad latente. Antes de aplicarla se requiere backup del esquema, inventario
de grants/políticas y aprobación explícita del SQL completo.

Si el corte falla, los envíos permanecen bloqueados y se corrige hacia adelante;
no se restauran automáticamente los grants públicos.

## Pruebas

- SQL: estructura, permisos, RPC, idempotencia, ventanas móviles, medianoche,
  limpieza y rechazo del INSERT directo.
- Deno: cuerpo streaming, tipos, campos desconocidos, IP, auth publicable,
  Turnstile, idempotency key, concurrencia de invocaciones y logs.
- React: servicio limitado y pantalla de comprobante.
- Playwright: flujo interceptado y ausencia de `POST /rest/v1/reports`.

Las pruebas SQL no se ejecutan hasta tener un entorno local descartable con las
migraciones aplicadas. Nunca se ejecutan en producción.

## Configuración de staging

Frontend pública:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_CITY_SLUG`;
- `VITE_TURNSTILE_SITE_KEY`.

Edge Function privada u operativa:

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEYS` o fallback local `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEYS` o fallback heredado `SUPABASE_SERVICE_ROLE_KEY`;
- `ALLOWED_ORIGINS`;
- `TURNSTILE_SECRET_KEY`;
- `TURNSTILE_ALLOWED_HOSTNAMES`;
- `TURNSTILE_EXPECTED_ACTION=submit_report`;
- `RATE_LIMIT_PEPPER`;
- `TRUST_LOCAL_PROXY_HEADERS=true` solo en local, nunca en hosted.

No se incluyen valores reales en el repositorio ni en comandos documentados.

## Estrategia de staging futura

1. Autorizar staging y verificar backup/Fase 1B.
2. Confirmar que `pg_cron` existe.
3. Aplicar la primera migración.
4. Cargar y revisar límites oficiales.
5. Configurar secretos y desplegar la Edge Function.
6. Probar función, idempotencia, cuota y respuesta.
7. Mostrar y aprobar la migración de corte.
8. Aplicar el corte y desplegar el frontend.
9. Ejecutar SQL, E2E y pruebas manuales.
10. Confirmar que no existe tráfico directo a `reports`.

Producción requiere otro plan, backup, ventana y aprobación.
